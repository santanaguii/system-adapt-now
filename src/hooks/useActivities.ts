import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CustomField, SortOption } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { getPriorityValue } from './useActivities.utils';
import {
  ACTIVITY_META,
  collectSearchableText,
  createMetaPatch,
  getRecurrence,
  nextRecurrenceDate,
} from '@/lib/activity-meta';
import { getDateKeyInTimeZone } from '@/lib/date';

interface ActivityRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  completed: boolean;
  tags: string[];
  custom_fields: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

type PendingOperation =
  | { type: 'add'; activity: Activity }
  | { type: 'update'; id: string; updates: Partial<Activity> }
  | { type: 'delete'; id: string }
  | { type: 'reorder'; orderedIds: string[] };

type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline';

function pendingKey(userId: string) {
  return `activities:pending:${userId}`;
}

function readPendingOperations(userId: string): PendingOperation[] {
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    return raw ? JSON.parse(raw) as PendingOperation[] : [];
  } catch (error) {
    console.error('Error reading pending activity operations:', error);
    return [];
  }
}

function writePendingOperations(userId: string, operations: PendingOperation[]) {
  try {
    window.localStorage.setItem(pendingKey(userId), JSON.stringify(operations));
  } catch (error) {
    console.error('Error writing pending activity operations:', error);
  }
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status as Activity['status'],
    completed: row.completed,
    tags: row.tags || [],
    customFields: (row.custom_fields || {}) as Activity['customFields'],
    order: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

function sortByOrder(items: Activity[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function mergeActivityUpdate(activity: Activity, updates: Partial<Activity>) {
  return {
    ...activity,
    ...updates,
    customFields: updates.customFields
      ? { ...activity.customFields, ...updates.customFields }
      : activity.customFields,
    updatedAt: updates.updatedAt || new Date(),
  };
}

function applyOperation(items: Activity[], operation: PendingOperation) {
  switch (operation.type) {
    case 'add':
      return [...items.filter((item) => item.id !== operation.activity.id), operation.activity];
    case 'update':
      return items.map((item) =>
        item.id === operation.id ? mergeActivityUpdate(item, operation.updates) : item
      );
    case 'delete':
      return items.filter((item) => item.id !== operation.id);
    case 'reorder': {
      const orderMap = new Map(operation.orderedIds.map((id, index) => [id, index]));
      return items.map((item) =>
        orderMap.has(item.id)
          ? { ...item, order: orderMap.get(item.id) ?? item.order }
          : item
      );
    }
  }
}

function applyPendingOperations(items: Activity[], operations: PendingOperation[]) {
  return operations.reduce((current, operation) => applyOperation(current, operation), items);
}

export function useActivities(sortOption: SortOption = 'manual', customFields: CustomField[] = []) {
  const { user, isAuthenticated } = useAuthContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const pendingOperationsRef = useRef<PendingOperation[]>([]);

  const persistPending = useCallback((operations: PendingOperation[]) => {
    pendingOperationsRef.current = operations;
    if (user) {
      writePendingOperations(user.id, operations);
    }
    setSyncStatus(
      operations.length === 0
        ? (isOffline ? 'offline' : 'synced')
        : (isOffline ? 'offline' : 'pending')
    );
  }, [user, isOffline]);

  const queueOperation = useCallback((operation: PendingOperation) => {
    persistPending([...pendingOperationsRef.current, operation]);
  }, [persistPending]);

  const loadActivities = useCallback(async () => {
    if (!user) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('activities' as never)
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order') as { data: ActivityRow[] | null; error: unknown };

      if (error) {
        console.error('Error loading activities:', error);
        return;
      }

      const remoteActivities = (data || []).map(toActivity);
      const queued = readPendingOperations(user.id);
      pendingOperationsRef.current = queued;
      setActivities(sortByOrder(applyPendingOperations(remoteActivities, queued)));
      setSyncStatus(
        queued.length === 0
          ? (isOffline ? 'offline' : 'synced')
          : (isOffline ? 'offline' : 'pending')
      );
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isOffline]);

  const createRemoteActivity = useCallback(async (activity: Activity) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const { error } = await supabase
      .from('activities' as never)
      .insert({
        id: activity.id,
        user_id: user.id,
        title: activity.title,
        description: activity.description || null,
        status: activity.status,
        completed: activity.completed,
        tags: activity.tags,
        custom_fields: activity.customFields,
        sort_order: activity.order,
        created_at: activity.createdAt.toISOString(),
        updated_at: activity.updatedAt.toISOString(),
        completed_at: activity.completedAt?.toISOString() || null,
      } as never);

    if (error) {
      throw error;
    }
  }, [user]);

  const updateRemoteActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const dbUpdates: Partial<ActivityRow> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.customFields !== undefined) dbUpdates.custom_fields = updates.customFields as Record<string, unknown>;
    if (updates.order !== undefined) dbUpdates.sort_order = updates.order;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt?.toISOString() || null;

    const { error } = await supabase
      .from('activities' as never)
      .update(dbUpdates as never)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
  }, [user]);

  const deleteRemoteActivity = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const { error } = await supabase
      .from('activities' as never)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }
  }, [user]);

  const reorderRemoteActivities = useCallback(async (orderedIds: string[]) => {
    if (!user) {
      throw new Error('Missing user');
    }

    for (const [index, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from('activities' as never)
        .update({ sort_order: index } as never)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
    }
  }, [user]);

  const flushPendingSync = useCallback(async () => {
    if (!user || pendingOperationsRef.current.length === 0 || isOffline) {
      return;
    }

    setSyncStatus('syncing');
    const nextQueue: PendingOperation[] = [];

    for (const operation of pendingOperationsRef.current) {
      try {
        if (operation.type === 'add') {
          await createRemoteActivity(operation.activity);
        } else if (operation.type === 'update') {
          await updateRemoteActivity(operation.id, operation.updates);
        } else if (operation.type === 'delete') {
          await deleteRemoteActivity(operation.id);
        } else if (operation.type === 'reorder') {
          await reorderRemoteActivities(operation.orderedIds);
        }
      } catch (error) {
        console.error('Error flushing activity operation:', error);
        nextQueue.push(operation);
      }
    }

    persistPending(nextQueue);
    if (nextQueue.length === 0) {
      await loadActivities();
    }
  }, [
    user,
    isOffline,
    createRemoteActivity,
    updateRemoteActivity,
    deleteRemoteActivity,
    reorderRemoteActivities,
    persistPending,
    loadActivities,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActivities([]);
      setIsLoading(false);
      setSyncStatus('synced');
      return;
    }

    loadActivities();
  }, [isAuthenticated, user, loadActivities]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setSyncStatus(pendingOperationsRef.current.length > 0 ? 'offline' : 'synced');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOffline) {
      void flushPendingSync();
    }
  }, [isOffline, flushPendingSync]);

  const addActivity = useCallback(async (
    title: string,
    initialTags?: string[],
    initialCustomFields?: Activity['customFields']
  ) => {
    if (!user) return null;

    const defaultValues: Activity['customFields'] = {};
    customFields.forEach((field) => {
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        defaultValues[field.id] = field.defaultValue;
      }
    });

    const newActivity: Activity = {
      id: crypto.randomUUID(),
      title,
      status: 'open',
      completed: false,
      tags: initialTags || [],
      customFields: {
        ...defaultValues,
        ...createMetaPatch({
          [ACTIVITY_META.bucket]: 'inbox',
        }),
        ...(initialCustomFields || {}),
      },
      order: activities.filter((item) => !item.completed).length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setActivities((prev) => sortByOrder([...prev, newActivity]));

    if (isOffline) {
      queueOperation({ type: 'add', activity: newActivity });
      return newActivity;
    }

    try {
      await createRemoteActivity(newActivity);
      setSyncStatus('synced');
      return newActivity;
    } catch (error) {
      console.error('Error adding activity, queued for sync:', error);
      queueOperation({ type: 'add', activity: newActivity });
      return newActivity;
    }
  }, [user, customFields, activities, isOffline, createRemoteActivity, queueOperation]);

  const updateActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
    const existing = activities.find((activity) => activity.id === id);
    if (!existing) return;

    const optimisticActivity = mergeActivityUpdate(existing, updates);
    setActivities((prev) =>
      prev.map((activity) => (activity.id === id ? optimisticActivity : activity))
    );

    if (isOffline) {
      queueOperation({ type: 'update', id, updates });
      return;
    }

    try {
      await updateRemoteActivity(id, updates);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error updating activity, queued for sync:', error);
      queueOperation({ type: 'update', id, updates });
    }
  }, [activities, isOffline, queueOperation, updateRemoteActivity]);

  const deleteActivity = useCallback(async (id: string) => {
    setActivities((prev) => prev.filter((activity) => activity.id !== id));

    if (isOffline) {
      queueOperation({ type: 'delete', id });
      return;
    }

    try {
      await deleteRemoteActivity(id);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error deleting activity, queued for sync:', error);
      queueOperation({ type: 'delete', id });
    }
  }, [isOffline, queueOperation, deleteRemoteActivity]);

  const toggleComplete = useCallback(async (id: string) => {
    const activity = activities.find((item) => item.id === id);
    if (!activity) return;

    const completed = !activity.completed;
    const updates: Partial<Activity> = {
      completed,
      status: completed ? 'done' : 'open',
      completedAt: completed ? new Date() : undefined,
      updatedAt: new Date(),
    };

    await updateActivity(id, updates);

    if (completed) {
      const recurrence = getRecurrence(activity);
      const recurrenceBaseDate = typeof activity.customFields.dueDate === 'string'
        ? activity.customFields.dueDate as string
        : typeof activity.customFields[ACTIVITY_META.scheduledDate] === 'string'
          ? activity.customFields[ACTIVITY_META.scheduledDate] as string
        : getDateKeyInTimeZone();

      if (recurrence) {
        const nextDate = nextRecurrenceDate(recurrenceBaseDate, recurrence);
        await addActivity(activity.title, activity.tags, {
          ...activity.customFields,
          dueDate: nextDate,
          [ACTIVITY_META.bucket]: 'upcoming',
          [ACTIVITY_META.scheduledDate]: nextDate,
          [ACTIVITY_META.recurrence]: {
            ...recurrence,
            lastGeneratedAt: new Date().toISOString(),
            nextDate,
          },
        });
      }
    }
  }, [activities, updateActivity, addActivity]);

  const reorderActivities = useCallback(async (startIndex: number, endIndex: number) => {
    const activeActivities = activities.filter((activity) => !activity.completed);
    const completedActivities = activities.filter((activity) => activity.completed);

    const nextActive = [...activeActivities];
    const [removed] = nextActive.splice(startIndex, 1);
    nextActive.splice(endIndex, 0, removed);

    const reorderedActive = nextActive.map((activity, index) => ({ ...activity, order: index }));
    const nextActivities = [...reorderedActive, ...completedActivities];
    const orderedIds = reorderedActive.map((activity) => activity.id);

    setActivities(nextActivities);

    if (isOffline) {
      queueOperation({ type: 'reorder', orderedIds });
      return;
    }

    try {
      await reorderRemoteActivities(orderedIds);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error reordering activities, queued for sync:', error);
      queueOperation({ type: 'reorder', orderedIds });
    }
  }, [activities, isOffline, queueOperation, reorderRemoteActivities]);

  const sortActivities = useCallback((activitiesToSort: Activity[], sort: SortOption): Activity[] => {
    const sorted = [...activitiesToSort];

    switch (sort) {
      case 'dueDate_asc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.customFields.dueDate === 'string' ? a.customFields.dueDate : null;
          const dateB = typeof b.customFields.dueDate === 'string' ? b.customFields.dueDate : null;
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      case 'dueDate_desc':
        return sorted.sort((a, b) => {
          const dateA = typeof a.customFields.dueDate === 'string' ? a.customFields.dueDate : null;
          const dateB = typeof b.customFields.dueDate === 'string' ? b.customFields.dueDate : null;
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      case 'priority_asc':
        return sorted.sort(
          (a, b) => getPriorityValue(b.customFields.priority) - getPriorityValue(a.customFields.priority)
        );
      case 'priority_desc':
        return sorted.sort(
          (a, b) => getPriorityValue(a.customFields.priority) - getPriorityValue(b.customFields.priority)
        );
      case 'createdAt_desc':
        return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      case 'manual':
      default:
        return sorted.sort((a, b) => a.order - b.order);
    }
  }, []);

  const sortedActivities = useMemo(() => {
    const active = activities.filter((activity) => !activity.completed);
    const completed = activities.filter((activity) => activity.completed);

    return {
      active: sortActivities(active, sortOption),
      completed: completed.sort(
        (a, b) => new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime()
      ),
    };
  }, [activities, sortOption, sortActivities]);

  const searchActivities = useCallback((query: string) => {
    if (!query.trim()) return activities;
    const lowerQuery = query.toLowerCase();
    return activities.filter((activity) => {
      const haystack = [
        activity.title,
        activity.description || '',
        ...Object.values(activity.customFields).flatMap((value) => collectSearchableText(value)),
      ].join(' ').toLowerCase();

      return haystack.includes(lowerQuery);
    });
  }, [activities]);

  return {
    activities,
    isLoading,
    isOffline,
    syncStatus,
    pendingSyncCount: pendingOperationsRef.current.length,
    sortedActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleComplete,
    reorderActivities,
    searchActivities,
    flushPendingSync,
    refreshActivities: loadActivities,
  };
}
