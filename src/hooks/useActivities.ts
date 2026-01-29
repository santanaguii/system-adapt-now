import { useCallback, useMemo, useState, useEffect } from 'react';
import { Activity, SortOption, CustomField } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';

// Type definition for external Supabase table
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

export function useActivities(sortOption: SortOption = 'manual', customFields: CustomField[] = []) {
  const { user, isAuthenticated } = useAuthContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load activities from database
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    const loadActivities = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('activities' as never)
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order') as { data: ActivityRow[] | null; error: unknown };

        if (error) {
          console.error('Error loading activities:', error);
          setIsLoading(false);
          return;
        }

        if (data) {
          const loadedActivities: Activity[] = data.map(row => ({
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
          }));
          setActivities(loadedActivities);
        }
      } catch (error) {
        console.error('Error loading activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActivities();
  }, [isAuthenticated, user]);

  const addActivity = useCallback(async (title: string) => {
    if (!user) return null;

    const defaultValues: Record<string, string | number | boolean | Date | string[] | null> = {};
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
      tags: [],
      customFields: defaultValues,
      order: activities.filter((a) => !a.completed).length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optimistic update
    setActivities((prev) => [newActivity, ...prev]);

    try {
      const { error } = await supabase
        .from('activities' as never)
        .insert({
          id: newActivity.id,
          user_id: user.id,
          title: newActivity.title,
          status: newActivity.status,
          completed: newActivity.completed,
          tags: newActivity.tags,
          custom_fields: newActivity.customFields,
          sort_order: newActivity.order,
          created_at: newActivity.createdAt.toISOString(),
          updated_at: newActivity.updatedAt.toISOString(),
        } as never);

      if (error) {
        console.error('Error adding activity:', error);
        // Rollback
        setActivities((prev) => prev.filter((a) => a.id !== newActivity.id));
        return null;
      }

      return newActivity;
    } catch (error) {
      console.error('Error adding activity:', error);
      setActivities((prev) => prev.filter((a) => a.id !== newActivity.id));
      return null;
    }
  }, [user, activities, customFields]);

  const updateActivity = useCallback(async (id: string, updates: Partial<Activity>) => {
    if (!user) return;

    // Optimistic update
    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === id
          ? { ...activity, ...updates, updatedAt: new Date() }
          : activity
      )
    );

    try {
      // Convert to DB format
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
        console.error('Error updating activity:', error);
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }, [user]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!user) return;

    // Keep for potential rollback
    const deletedActivity = activities.find((a) => a.id === id);

    // Optimistic update
    setActivities((prev) => prev.filter((activity) => activity.id !== id));

    try {
      const { error } = await supabase
        .from('activities' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting activity:', error);
        // Rollback
        if (deletedActivity) {
          setActivities((prev) => [...prev, deletedActivity]);
        }
      }
    } catch (error) {
      console.error('Error deleting activity:', error);
      if (deletedActivity) {
        setActivities((prev) => [...prev, deletedActivity]);
      }
    }
  }, [user, activities]);

  const toggleComplete = useCallback(async (id: string) => {
    if (!user) return;

    const activity = activities.find((a) => a.id === id);
    if (!activity) return;

    const completed = !activity.completed;
    const updates: Partial<Activity> = {
      completed,
      status: completed ? 'done' as const : 'open' as const,
      completedAt: completed ? new Date() : undefined,
      updatedAt: new Date(),
    };

    // Optimistic update
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } as Activity : a))
    );

    try {
      const { error } = await supabase
        .from('activities' as never)
        .update({
          completed,
          status: updates.status,
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error toggling complete:', error);
      }
    } catch (error) {
      console.error('Error toggling complete:', error);
    }
  }, [user, activities]);

  const reorderActivities = useCallback(async (startIndex: number, endIndex: number) => {
    if (!user) return;

    // Get active activities only
    const activeActivities = activities.filter((a) => !a.completed);
    const completedActivities = activities.filter((a) => a.completed);

    const [removed] = activeActivities.splice(startIndex, 1);
    activeActivities.splice(endIndex, 0, removed);

    const reorderedActive = activeActivities.map((a, index) => ({
      ...a,
      order: index,
    }));

    // Optimistic update
    setActivities([...reorderedActive, ...completedActivities]);

    // Update in database
    try {
      for (let i = 0; i < reorderedActive.length; i++) {
        await supabase
          .from('activities' as never)
          .update({ sort_order: i } as never)
          .eq('id', reorderedActive[i].id)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error reordering activities:', error);
    }
  }, [user, activities]);

  const sortActivities = useCallback((activitiesToSort: Activity[], sort: SortOption): Activity[] => {
    const sorted = [...activitiesToSort];
    
    switch (sort) {
      case 'dueDate_asc':
        return sorted.sort((a, b) => {
          const dateA = a.customFields.dueDate as string | null;
          const dateB = b.customFields.dueDate as string | null;
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      case 'dueDate_desc':
        return sorted.sort((a, b) => {
          const dateA = a.customFields.dueDate as string | null;
          const dateB = b.customFields.dueDate as string | null;
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      case 'priority_asc':
        const priorityOrderAsc = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };
        return sorted.sort((a, b) => {
          const prioA = (a.customFields.priority as string) || '';
          const prioB = (b.customFields.priority as string) || '';
          return (priorityOrderAsc[prioA as keyof typeof priorityOrderAsc] || 4) - 
                 (priorityOrderAsc[prioB as keyof typeof priorityOrderAsc] || 4);
        });
      case 'priority_desc':
        const priorityOrderDesc = { 'Baixa': 1, 'Média': 2, 'Alta': 3 };
        return sorted.sort((a, b) => {
          const prioA = (a.customFields.priority as string) || '';
          const prioB = (b.customFields.priority as string) || '';
          return (priorityOrderDesc[prioA as keyof typeof priorityOrderDesc] || 4) - 
                 (priorityOrderDesc[prioB as keyof typeof priorityOrderDesc] || 4);
        });
      case 'createdAt_desc':
        return sorted.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'manual':
      default:
        return sorted.sort((a, b) => a.order - b.order);
    }
  }, []);

  const sortedActivities = useMemo(() => {
    const active = activities.filter((a) => !a.completed);
    const completed = activities.filter((a) => a.completed);

    return {
      active: sortActivities(active, sortOption),
      completed: completed.sort((a, b) => 
        new Date(b.completedAt || b.updatedAt).getTime() - 
        new Date(a.completedAt || a.updatedAt).getTime()
      ),
    };
  }, [activities, sortOption, sortActivities]);

  const searchActivities = useCallback((query: string) => {
    if (!query.trim()) return activities;
    const lowerQuery = query.toLowerCase();
    return activities.filter((a) => {
      if (a.title.toLowerCase().includes(lowerQuery)) return true;
      if (a.description?.toLowerCase().includes(lowerQuery)) return true;
      for (const value of Object.values(a.customFields)) {
        if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) return true;
      }
      return false;
    });
  }, [activities]);

  return {
    activities,
    isLoading,
    sortedActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleComplete,
    reorderActivities,
    searchActivities,
  };
}
