import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Tag, CustomField, SortOption, ActivityListDisplaySettings, FilterConfig } from '@/types';
import { ActivityItem } from './ActivityItem';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Filter, ChevronDown, ChevronUp, ArrowUpDown, GripVertical, ChevronRight, X, CalendarDays, AlertTriangle, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ACTIVITY_META,
  buildDependencySyncUpdates,
  collectSearchableText,
  createMetaPatch,
  deriveProjects,
  getActivityBucket,
  getBlockedBy,
  getProjectName,
  getScheduledDate,
  shouldShowInToday,
} from '@/lib/activity-meta';
import { addDaysToDateKey, endOfMonthDateKey, getDateKeyInTimeZone, normalizeDateKey, parseDateKey } from '@/lib/date';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ActivityDetail = lazy(() =>
  import('./ActivityDetail').then((module) => ({ default: module.ActivityDetail }))
);
const ActivityCreateDialog = lazy(() =>
  import('./ActivityCreateDialog').then((module) => ({ default: module.ActivityCreateDialog }))
);

type ActivityViewMode = 'all' | 'today' | 'week' | 'month' | 'backlog' | 'waiting' | 'projects';
const COMPLETION_PREVIEW_MS = 900;

interface ActivityListProps {
  currentDate: Date;
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  onAdd: (title: string, tags?: string[], customFields?: Activity['customFields']) => Promise<Activity | null> | Activity | null;
  onUpdate: (id: string, updates: Partial<Activity>) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  onOpenSettings: () => void;
  onUpdateListDisplay?: (updates: Partial<ActivityListDisplaySettings>) => Promise<void> | void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  allowReopenCompleted: boolean;
  showQuickRescheduleButtons?: boolean;
  quickRescheduleDaysThreshold?: number;
  visualVariant?: 'table' | 'legacy';
}

interface SelectedActivityState {
  id: string;
  readOnly: boolean;
}

function EditableTableTitle({
  activity,
  onUpdate,
  onOpenDetail,
}: {
  activity: Activity;
  onUpdate: (id: string, updates: Partial<Activity>) => void;
  onOpenDetail: (activity: Activity) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(activity.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(activity.title);
  }, [activity.title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue) {
      onUpdate(activity.id, { title: trimmedValue });
    } else {
      setEditValue(activity.title);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(activity.title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(event) => setEditValue(event.target.value)}
        onBlur={handleSave}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleSave();
          } else if (event.key === 'Escape') {
            handleCancel();
          }
        }}
        className="w-full border-none bg-transparent text-sm font-semibold text-foreground outline-none"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      />
    );
  }

  return (
    <p
      className="truncate cursor-text text-sm font-semibold text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onOpenDetail(activity);
      }}
    >
      {activity.title}
    </p>
  );
}

function formatTableFieldValue(field: CustomField, value: unknown) {
  if (value === null || value === undefined || value === '' || typeof value === 'object') {
    return null;
  }

  if (field.type === 'date' && typeof value === 'string') {
    const normalizedValue = normalizeDateKey(value);
    return normalizedValue ? format(parseDateKey(normalizedValue), 'd MMM', { locale: ptBR }) : value;
  }

  if (field.type === 'boolean') {
    return value ? 'Sim' : 'Nao';
  }

  if (field.type === 'currency' && typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  return String(value);
}

function formatActivityDueDateLabel(dueDate: string | null, todayKey: string, tomorrowKey: string) {
  if (!dueDate) {
    return 'Sem prazo';
  }

  if (dueDate === todayKey) {
    return 'hoje';
  }

  if (dueDate === tomorrowKey) {
    return 'amanha';
  }

  return format(parseDateKey(dueDate), 'dd/MM', { locale: ptBR });
}

function getDueDateTone(dueDate: string | null, todayKey: string) {
  if (!dueDate) {
    return 'text-muted-foreground';
  }

  if (dueDate < todayKey) {
    return 'text-red-600 dark:text-red-400';
  }

  if (dueDate === todayKey) {
    return 'text-orange-600 dark:text-orange-300';
  }

  return 'text-foreground';
}

function getClassificationBadge(
  activity: Activity,
  tags: Tag[],
  priority: string | null,
  status: ActivityStatus
) {
  const firstTag = tags.find((tag) => activity.tags.includes(tag.id));

  if (firstTag) {
    return {
      label: firstTag.name,
      className: '',
      style: {
        backgroundColor: `${firstTag.color}18`,
        color: firstTag.color,
      } as React.CSSProperties,
    };
  }

  if (priority) {
    const normalized = priority.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const map: Record<string, { label: string; className: string }> = {
      alta: { label: priority, className: 'bg-red-500/10 text-red-700 dark:text-red-300' },
      media: { label: priority, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
      baixa: { label: priority, className: 'bg-stone-500/10 text-stone-700 dark:text-stone-300' },
    };
    return {
      label: map[normalized]?.label ?? priority,
      className: map[normalized]?.className ?? 'bg-stone-500/10 text-stone-700 dark:text-stone-300',
      style: undefined,
    };
  }

  return {
    label: activityStatusConfig[status].label,
    className:
      status === 'overdue'
        ? 'bg-red-500/10 text-red-700 dark:text-red-300'
        : status === 'onTrack'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-stone-500/10 text-stone-700 dark:text-stone-300',
    style: undefined,
  };
}

type TableColumn = {
  id: string;
  label: string;
  desktopWidth: string;
  mobileLabel?: string;
  render: (activity: Activity, context: { status: ActivityStatus; dueDate: string | null; priority: string | null }) => React.ReactNode;
};

function TableRowActions({
  activity,
  quickActions,
  onOpenDetail,
  onDelete,
}: {
  activity: Activity;
  quickActions: React.ReactNode;
  onOpenDetail: (activity: Activity) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {quickActions ? <div className="flex flex-wrap justify-end gap-2">{quickActions}</div> : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail(activity);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        title="Abrir detalhes"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(activity.id);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        title="Excluir atividade"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function getRelevantDate(activity: Activity) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
  return dueDate || getScheduledDate(activity);
}

type ActivityStatus = 'overdue' | 'onTrack' | 'noDueDate';

const activityStatusConfig: Record<ActivityStatus, { label: string; color: string }> = {
  overdue: { label: 'Atrasada', color: 'border-rose-500/80 bg-rose-500/10 text-rose-600' },
  onTrack: { label: 'Em dia', color: 'border-emerald-500/80 bg-emerald-500/10 text-emerald-700' },
  noDueDate: { label: 'Sem prazo', color: 'border-slate-500/80 bg-slate-500/10 text-slate-700' },
};

const getActivityStatus = (activity: Activity, todayKey: string): ActivityStatus => {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
  const blockedBy = getBlockedBy(activity);

  if (!dueDate || Boolean(blockedBy)) {
    return 'noDueDate';
  }

  if (dueDate < todayKey) {
    return 'overdue';
  }

  return 'onTrack';
};

export function ActivityList({
  activities,
  tags,
  customFields,
  listDisplay,
  savedFilters,
  onAdd,
  onUpdate,
  onDelete,
  onToggleComplete,
  onReorder,
  onOpenSettings,
  onUpdateListDisplay,
  sortOption,
  onSortChange,
  allowReopenCompleted,
  showQuickRescheduleButtons = true,
  quickRescheduleDaysThreshold = 0,
  visualVariant = 'table',
}: ActivityListProps) {
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivityState, setSelectedActivityState] = useState<SelectedActivityState | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewActivityDialog, setShowNewActivityDialog] = useState(false);
  const [newActivityTags, setNewActivityTags] = useState<string[]>([]);
  const [newActivityFields, setNewActivityFields] = useState<Record<string, unknown>>({});
  const [viewMode, setViewMode] = useState<ActivityViewMode>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [completingActivities, setCompletingActivities] = useState<Record<string, Activity>>({});
  const completionTimeoutsRef = useRef<Map<string, number>>(new Map());
  const completingActivitiesRef = useRef<Record<string, Activity>>({});

  const todayKey = getDateKeyInTimeZone();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const nextWeekKey = addDaysToDateKey(todayKey, 7);
  const monthEndKey = endOfMonthDateKey(todayKey);
  const projectNames = useMemo(() => deriveProjects(activities.active), [activities.active]);
  const allActivities = useMemo(() => {
    const merged = new Map<string, Activity>();
    [...activities.active, ...activities.completed].forEach((activity) => {
      merged.set(activity.id, activity);
    });
    Object.values(completingActivities).forEach((activity) => {
      merged.set(activity.id, activity);
    });
    return Array.from(merged.values());
  }, [activities.active, activities.completed, completingActivities]);
  const selectedActivity = useMemo(
    () => selectedActivityState ? allActivities.find((activity) => activity.id === selectedActivityState.id) ?? null : null,
    [allActivities, selectedActivityState]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getCreationDefaults = () => {
    if (viewMode === 'today') {
      return { dueDate: todayKey, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'today' }) };
    }
    if (viewMode === 'week' || viewMode === 'month') {
      return { dueDate: tomorrowKey, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'upcoming' }) };
    }
    if (viewMode === 'backlog') {
      return { dueDate: null, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'someday' }) };
    }
    return createMetaPatch({ [ACTIVITY_META.bucket]: 'inbox' });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      if (sortOption !== 'manual') {
        onSortChange('manual');
      }
      const oldIndex = activities.active.findIndex((activity) => activity.id === active.id);
      const newIndex = activities.active.findIndex((activity) => activity.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  const applyFilter = (activity: Activity, filter: FilterConfig): boolean => {
    if (filter.type === 'tag' && filter.tagId) {
      return activity.tags.includes(filter.tagId);
    }

    if (filter.type === 'field' && filter.fieldId) {
      const fieldValue = activity.customFields[filter.fieldId];
      switch (filter.operator) {
        case 'isEmpty':
          return fieldValue === null || fieldValue === undefined || fieldValue === '';
        case 'isNotEmpty':
          return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        case 'equals':
          return fieldValue === filter.value;
        case 'contains':
          return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(filter.value).toLowerCase());
        case 'gt':
          return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue > filter.value;
        case 'lt':
          return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue < filter.value;
        case 'gte':
          return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue >= filter.value;
        case 'lte':
          return typeof fieldValue === 'number' && typeof filter.value === 'number' && fieldValue <= filter.value;
        case 'between':
          return typeof fieldValue === 'number' && typeof filter.value === 'number' && typeof filter.value2 === 'number' && fieldValue >= filter.value && fieldValue <= filter.value2;
        default:
          return true;
      }
    }

    return true;
  };

  const matchesView = (activity: Activity) => {
    const relevantDate = getRelevantDate(activity);
    const bucket = getActivityBucket(activity);
    const blockedBy = getBlockedBy(activity);
    const project = getProjectName(activity);

    switch (viewMode) {
      case 'today':
        return shouldShowInToday(activity, todayKey);
      case 'week':
        return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= nextWeekKey;
      case 'month':
        return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= monthEndKey;
      case 'backlog':
        return bucket === 'someday' || bucket === 'inbox' || (!relevantDate && !blockedBy);
      case 'waiting':
        return Boolean(blockedBy);
      case 'projects':
        return selectedProject === 'all' ? Boolean(project) : project === selectedProject;
      case 'all':
      default:
        return true;
    }
  };

  const filterActivities = (items: Activity[]) => {
    let filtered = items.filter(matchesView);

    if (savedFilters.length > 0) {
      filtered = filtered.filter((activity) => savedFilters.every((filter) => applyFilter(activity, filter)));
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((activity) => activity.tags.some((tagId) => selectedTags.includes(tagId)));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((activity) => {
        const haystack = [
          activity.title,
          activity.description || '',
          ...Object.values(activity.customFields).flatMap((value) => collectSearchableText(value)),
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }

    return filtered;
  };

  const filteredActive = filterActivities(activities.active);
  const filteredCompleted = filterActivities(activities.completed);
  const displayActive = filteredActive.map((activity) => completingActivities[activity.id] ?? activity);
  const listFields = customFields.filter((field) => field.enabled && (field.display === 'list' || field.display === 'both'));
  const canDrag =
    viewMode === 'all' &&
    selectedTags.length === 0 &&
    !searchQuery.trim() &&
    savedFilters.length === 0 &&
    !displayActive.some((activity) => activity.id in completingActivities);

  useEffect(() => {
    completingActivitiesRef.current = completingActivities;
  }, [completingActivities]);

  useEffect(() => {
    if (selectedActivityState && !selectedActivity) {
      setSelectedActivityState(null);
    }
  }, [selectedActivity, selectedActivityState]);

  useEffect(() => {
    const activeIds = new Set(activities.active.map((activity) => activity.id));

    setCompletingActivities((prev) => {
      let changed = false;
      const next: Record<string, Activity> = {};

      Object.entries(prev).forEach(([id, activity]) => {
        if (activeIds.has(id)) {
          next[id] = activity;
          return;
        }

        changed = true;
        const timeoutId = completionTimeoutsRef.current.get(id);
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
          completionTimeoutsRef.current.delete(id);
        }
      });

      return changed ? next : prev;
    });
  }, [activities.active]);

  useEffect(() => {
    const timeouts = completionTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const waitingCount = activities.active.filter((activity) => Boolean(getBlockedBy(activity))).length;
  const backlogCount = activities.active.filter((activity) => {
    const relevantDate = getRelevantDate(activity);
    const blockedBy = getBlockedBy(activity);
    const bucket = getActivityBucket(activity);
    return bucket === 'someday' || bucket === 'inbox' || (!relevantDate && !blockedBy);
  }).length;

  const viewOptions: Array<{ id: ActivityViewMode; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: activities.active.length },
    { id: 'today', label: 'Hoje', count: activities.active.filter((activity) => shouldShowInToday(activity, todayKey)).length },
    { id: 'week', label: 'Semana', count: activities.active.filter((activity) => { const relevantDate = getRelevantDate(activity); return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= nextWeekKey; }).length },
    { id: 'month', label: 'Mes', count: activities.active.filter((activity) => { const relevantDate = getRelevantDate(activity); return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= monthEndKey; }).length },
    { id: 'backlog', label: 'S/data', count: backlogCount },
  ];

  const sortLabels: Record<SortOption, string> = {
    manual: 'Manual',
    dueDate_asc: 'Prazo (crescente)',
    dueDate_desc: 'Prazo (decrescente)',
    priority_asc: 'Prioridade (alta primeiro)',
    priority_desc: 'Prioridade (baixa primeiro)',
    createdAt_desc: 'Mais recentes',
    tag: 'Por Tag',
    field: 'Por Campo',
  };
  const availableSortOptions: SortOption[] = ['manual', 'createdAt_desc'];

  if (customFields.some((field) => field.enabled && field.key === 'dueDate')) {
    availableSortOptions.push('dueDate_asc', 'dueDate_desc');
  }

  if (customFields.some((field) => field.enabled && field.key === 'priority')) {
    availableSortOptions.push('priority_asc', 'priority_desc');
  }

  const quickActions = (activity: Activity) => (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-6 rounded-full border-[#dccfbf] bg-white/80 px-2 text-[11px] font-medium text-stone-700 hover:bg-white"
        onClick={(event) => {
          event.stopPropagation();
          onUpdate(activity.id, { customFields: { dueDate: todayKey, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'today' }) } });
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        Hoje
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 rounded-full border-[#dccfbf] bg-white/80 px-2 text-[11px] font-medium text-stone-700 hover:bg-white"
        onClick={(event) => {
          event.stopPropagation();
          onUpdate(activity.id, { customFields: { dueDate: tomorrowKey, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'upcoming' }) } });
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        Amanha
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 rounded-full border-[#dccfbf] bg-white/80 px-2 text-[11px] font-medium text-stone-700 hover:bg-white"
        onClick={(event) => {
          event.stopPropagation();
          onUpdate(activity.id, { customFields: { dueDate: nextWeekKey, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'upcoming' }) } });
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        +7 dias
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 rounded-full border-[#dccfbf] bg-white/80 px-2 text-[11px] font-medium text-stone-700 hover:bg-white"
        onClick={(event) => {
          event.stopPropagation();
          onUpdate(activity.id, { customFields: { dueDate: null, ...createMetaPatch({ [ACTIVITY_META.bucket]: 'someday' }) } });
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        S/data
      </Button>
    </>
  );

  const shouldShowQuickActions = useCallback((activity: Activity) => {
    if (!showQuickRescheduleButtons) {
      return false;
    }

    const relevantDate = getRelevantDate(activity);
    if (!relevantDate) {
      return true;
    }

    return relevantDate <= addDaysToDateKey(todayKey, Math.max(0, quickRescheduleDaysThreshold));
  }, [quickRescheduleDaysThreshold, showQuickRescheduleButtons, todayKey]);

  const syncDependencies = (currentActivityId: string, previousCustomFields: Activity['customFields'], nextCustomFields: Activity['customFields']) => {
    const relatedUpdates = buildDependencySyncUpdates({
      activities: allActivities,
      currentActivityId,
      previousCustomFields,
      nextCustomFields,
    });

    relatedUpdates.forEach((update) => {
      onUpdate(update.id, { customFields: update.customFields });
    });
  };

  const handleToggleComplete = useCallback((id: string) => {
    const pendingPreview = completingActivitiesRef.current[id];
    if (pendingPreview) {
      const timeoutId = completionTimeoutsRef.current.get(id);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        completionTimeoutsRef.current.delete(id);
      }

      setCompletingActivities((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    const activeActivity = activities.active.find((activity) => activity.id === id);
    if (!activeActivity) {
      onToggleComplete(id);
      return;
    }

    const previewActivity: Activity = {
      ...activeActivity,
      completed: true,
      status: 'done',
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    setCompletingActivities((prev) => ({
      ...prev,
      [id]: previewActivity,
    }));

    const timeoutId = window.setTimeout(() => {
      completionTimeoutsRef.current.delete(id);
      setCompletingActivities((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onToggleComplete(id);
    }, COMPLETION_PREVIEW_MS);

    completionTimeoutsRef.current.set(id, timeoutId);
  }, [activities.active, onToggleComplete]);

  const handleOpenActivityDetail = useCallback((activity: Activity) => {
    setSelectedActivityState({
      id: activity.id,
      readOnly: activity.completed,
    });
  }, []);

  const tableVisibleFields = useMemo(
    () => customFields.filter((field) => field.enabled && (listDisplay.visibleFieldIds || []).includes(field.id)),
    [customFields, listDisplay.visibleFieldIds]
  );
  const tableColumns = useMemo<TableColumn[]>(() => {
    const columns: TableColumn[] = [];

    if (listDisplay.showTags || listDisplay.showPriority) {
      columns.push({
        id: 'classification',
        label: 'Classificacao',
        desktopWidth: '120px',
        mobileLabel: 'Classificacao',
        render: (activity, context) => {
          const classification = getClassificationBadge(activity, tags, context.priority, context.status);
          return (
            <span
              className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${classification.className}`}
              style={classification.style}
            >
              {classification.label}
            </span>
          );
        },
      });
    }

    tableVisibleFields.forEach((field) => {
      columns.push({
        id: field.id,
        label: field.name,
        desktopWidth: '120px',
        mobileLabel: field.name,
        render: (activity) => {
          const value = activity.customFields[field.id] ?? activity.customFields[field.key];
          const formattedValue = formatTableFieldValue(field, value);
          return formattedValue ? <span className="truncate">{formattedValue}</span> : <span className="text-muted-foreground">-</span>;
        },
      });
    });

    if (listDisplay.showDueDate) {
      columns.push({
        id: 'dueDate',
        label: 'Prazo',
        desktopWidth: '108px',
        mobileLabel: 'Prazo',
        render: (_activity, context) => {
          const dueDateLabel = formatActivityDueDateLabel(context.dueDate, todayKey, tomorrowKey);
          const dueDateTone = getDueDateTone(context.dueDate, todayKey);
          return <span className={`font-semibold ${dueDateTone}`}>{dueDateLabel}</span>;
        },
      });
    }

    return columns;
  }, [listDisplay.showDueDate, listDisplay.showPriority, listDisplay.showTags, tableVisibleFields, tags, todayKey, tomorrowKey]);
  const desktopGridTemplate = useMemo(
    () => ['22px', '28px', 'minmax(280px,1.9fr)', ...tableColumns.map((column) => column.desktopWidth), '92px'].join(' '),
    [tableColumns]
  );
  const modernVisualMode = listDisplay.visualMode ?? 'cards';
  const useLegacyLayout = visualVariant === 'legacy';
  const useInlineTableLayout = !useLegacyLayout && modernVisualMode === 'table';

  function renderStackedSummary(
    activity: Activity,
    status: ActivityStatus,
    dueDate: string | null,
    priority: string | null,
    className: string
  ) {
    const visibleItems = tableColumns
      .map((column) => {
        const content = column.render(activity, { status, dueDate, priority });
        return content ? (
          <div key={column.id} className="flex min-w-[112px] flex-1 flex-col gap-1 rounded-2xl border border-[#e4d8c8] bg-[#f5efe6] px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset] dark:border-border dark:bg-muted/50">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-muted-foreground">{column.mobileLabel || column.label}</span>
            {content}
          </div>
        ) : null;
      })
      .filter(Boolean);

    if (visibleItems.length === 0) {
      return null;
    }

    return <div className={className}>{visibleItems}</div>;
  }

  function renderCardMeta(activity: Activity, status: ActivityStatus, dueDate: string | null, priority: string | null) {
    const items: Array<{ id: string; label?: string; value: string; tone?: string }> = [];

    tableColumns.forEach((column) => {
      if (column.id === 'classification') {
        const classification = getClassificationBadge(activity, tags, priority, status);
        items.push({ id: column.id, value: classification.label, tone: 'text-stone-600 dark:text-muted-foreground' });
        return;
      }

      if (column.id === 'dueDate') {
        const dueDateLabel = formatActivityDueDateLabel(dueDate, todayKey, tomorrowKey);
        items.push({ id: column.id, value: dueDateLabel, tone: getDueDateTone(dueDate, todayKey) });
        return;
      }

      const field = tableVisibleFields.find((item) => item.id === column.id);
      if (!field) {
        return;
      }

      const value = activity.customFields[field.id] ?? activity.customFields[field.key];
      const formattedValue = formatTableFieldValue(field, value) ?? '-';
      items.push({
        id: field.id,
        label: field.name,
        value: formattedValue,
        tone: formattedValue === '-' ? 'text-muted-foreground' : 'text-stone-600 dark:text-muted-foreground',
      });
    });

    if (items.length === 0) {
      return null;
    }

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 dark:text-muted-foreground">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-stone-300 dark:text-border">•</span> : null}
            {item.id === 'dueDate' ? <CalendarDays className="h-3 w-3" /> : null}
            {item.label ? <span>{item.label}:</span> : null}
            <span className={`font-medium ${item.tone ?? 'text-stone-600 dark:text-foreground'}`}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  function ActivityTableRow({ activity }: { activity: Activity }) {
    const status = getActivityStatus(activity, todayKey);
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    const priority = typeof activity.customFields.priority === 'string' ? activity.customFields.priority : null;

    return (
      <div
        className="group border-b border-[#e2d6c7] px-4 py-3 transition-colors hover:bg-[#fbf6ef] dark:border-border dark:hover:bg-muted/30"
        onDoubleClick={() => handleOpenActivityDetail(activity)}
      >
        <div className="flex items-start gap-2.5">
          <div className="hidden h-7 w-5 items-center justify-center pt-0.5 text-stone-400 md:flex">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex h-7 items-center justify-center">
            <Checkbox
              checked={activity.completed}
              onCheckedChange={() => handleToggleComplete(activity.id)}
              aria-label={activity.completed ? 'Reabrir atividade' : 'Concluir atividade'}
              className="h-5 w-5 rounded-full border-2"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <EditableTableTitle activity={activity} onUpdate={onUpdate} onOpenDetail={handleOpenActivityDetail} />
                {renderCardMeta(activity, status, dueDate, priority)}
              </div>
              <div className="shrink-0">
                <TableRowActions
                  activity={activity}
                  quickActions={null}
                  onOpenDetail={handleOpenActivityDetail}
                  onDelete={setDeleteConfirm}
                />
              </div>
            </div>
            {shouldShowQuickActions(activity) ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {quickActions(activity)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function SortableActivityTableRow({ activity }: { activity: Activity }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const status = getActivityStatus(activity, todayKey);
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    const priority = typeof activity.customFields.priority === 'string' ? activity.customFields.priority : null;

    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        className="group border-b border-[#e2d6c7] px-4 py-3 transition-colors hover:bg-[#fbf6ef] dark:border-border dark:hover:bg-muted/30"
        onDoubleClick={() => handleOpenActivityDetail(activity)}
      >
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            className="hidden h-7 w-5 items-center justify-center pt-0.5 text-stone-400 hover:text-stone-600 dark:text-muted-foreground md:flex"
            {...attributes}
            {...listeners}
            aria-label="Arrastar atividade"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex h-7 items-center justify-center">
            <Checkbox
              checked={activity.completed}
              onCheckedChange={() => handleToggleComplete(activity.id)}
              aria-label={activity.completed ? 'Reabrir atividade' : 'Concluir atividade'}
              className="h-5 w-5 rounded-full border-2"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <EditableTableTitle activity={activity} onUpdate={onUpdate} onOpenDetail={handleOpenActivityDetail} />
                {renderCardMeta(activity, status, dueDate, priority)}
              </div>
              <div className="shrink-0">
                <TableRowActions
                  activity={activity}
                  quickActions={null}
                  onOpenDetail={handleOpenActivityDetail}
                  onDelete={setDeleteConfirm}
                />
              </div>
            </div>
            {shouldShowQuickActions(activity) ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {quickActions(activity)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const renderCardsRow = (activity: Activity, sortable = false) => {
    return sortable ? <SortableActivityTableRow key={activity.id} activity={activity} /> : <ActivityTableRow key={activity.id} activity={activity} />;
  };

  function ActivityInlineTableRow({ activity }: { activity: Activity }) {
    const status = getActivityStatus(activity, todayKey);
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    const priority = typeof activity.customFields.priority === 'string' ? activity.customFields.priority : null;

    return (
      <div
        style={{ ['--activity-grid-template' as string]: desktopGridTemplate }}
        className="group grid min-w-full grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-[#ded6ca] px-4 py-3 transition-colors hover:bg-[#f8f3eb] dark:border-border dark:hover:bg-muted/40 md:[grid-template-columns:var(--activity-grid-template)] md:items-center md:gap-x-5 md:gap-y-0"
        onDoubleClick={() => handleOpenActivityDetail(activity)}
      >
        <div className="hidden h-8 w-[22px] items-center justify-center text-stone-400 md:inline-flex">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={activity.completed}
            onCheckedChange={() => handleToggleComplete(activity.id)}
            aria-label={activity.completed ? 'Reabrir atividade' : 'Concluir atividade'}
            className="h-5 w-5 rounded-full border-2"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        </div>
        <div className="min-w-0 md:pr-3">
          <div className="flex items-center gap-2">
            <EditableTableTitle activity={activity} onUpdate={onUpdate} onOpenDetail={handleOpenActivityDetail} />
            <div className="hidden shrink-0 flex-wrap gap-1 md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {shouldShowQuickActions(activity) ? quickActions(activity) : null}
            </div>
          </div>
          {renderStackedSummary(activity, status, dueDate, priority, 'mt-2 flex flex-wrap gap-2 md:hidden')}
        </div>
        {tableColumns.map((column) => (
          <div key={column.id} className="hidden min-w-0 items-center text-sm text-stone-700 dark:text-foreground md:flex">
            {column.render(activity, { status, dueDate, priority })}
          </div>
        ))}
        <div className="col-span-full flex flex-wrap items-center justify-between gap-3 pl-10 md:col-span-1 md:pl-0 md:justify-end">
          <div className="flex flex-wrap gap-2 md:hidden">
            {shouldShowQuickActions(activity) ? quickActions(activity) : null}
          </div>
          <TableRowActions
            activity={activity}
            quickActions={null}
            onOpenDetail={handleOpenActivityDetail}
            onDelete={setDeleteConfirm}
          />
        </div>
      </div>
    );
  }

  function SortableActivityInlineTableRow({ activity }: { activity: Activity }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const status = getActivityStatus(activity, todayKey);
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    const priority = typeof activity.customFields.priority === 'string' ? activity.customFields.priority : null;

    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, ['--activity-grid-template' as string]: desktopGridTemplate }}
        className="group grid min-w-full grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-[#ded6ca] px-4 py-3 transition-colors hover:bg-[#f8f3eb] dark:border-border dark:hover:bg-muted/40 md:[grid-template-columns:var(--activity-grid-template)] md:items-center md:gap-x-5 md:gap-y-0"
        onDoubleClick={() => handleOpenActivityDetail(activity)}
      >
        <button
          type="button"
          className="hidden h-8 w-[22px] items-center justify-center text-stone-400 hover:text-stone-600 dark:text-muted-foreground md:inline-flex"
          {...attributes}
          {...listeners}
          aria-label="Arrastar atividade"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={activity.completed}
            onCheckedChange={() => handleToggleComplete(activity.id)}
            aria-label={activity.completed ? 'Reabrir atividade' : 'Concluir atividade'}
            className="h-5 w-5 rounded-full border-2"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          />
        </div>
        <div className="min-w-0 md:pr-3">
          <div className="flex items-center gap-2">
            <EditableTableTitle activity={activity} onUpdate={onUpdate} onOpenDetail={handleOpenActivityDetail} />
            <div className="hidden shrink-0 flex-wrap gap-1 md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {shouldShowQuickActions(activity) ? quickActions(activity) : null}
            </div>
          </div>
          {renderStackedSummary(activity, status, dueDate, priority, 'mt-2 flex flex-wrap gap-2 md:hidden')}
        </div>
        {tableColumns.map((column) => (
          <div key={column.id} className="hidden min-w-0 items-center text-sm text-stone-700 dark:text-foreground md:flex">
            {column.render(activity, { status, dueDate, priority })}
          </div>
        ))}
        <div className="col-span-full flex flex-wrap items-center justify-between gap-3 pl-10 md:col-span-1 md:pl-0 md:justify-end">
          <div className="flex flex-wrap gap-2 md:hidden">
            {shouldShowQuickActions(activity) ? quickActions(activity) : null}
          </div>
          <TableRowActions
            activity={activity}
            quickActions={null}
            onOpenDetail={handleOpenActivityDetail}
            onDelete={setDeleteConfirm}
          />
        </div>
      </div>
    );
  }

  const renderInlineTableRow = (activity: Activity, sortable = false) => {
    return sortable
      ? <SortableActivityInlineTableRow key={activity.id} activity={activity} />
      : <ActivityInlineTableRow key={activity.id} activity={activity} />;
  };

  function SortableLegacyActivityRow({ activity }: { activity: Activity }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });
    const isCompleting = activity.id in completingActivities;

    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
        <ActivityItem
          activity={activity}
          tags={tags}
          customFields={listFields}
          listDisplay={listDisplay}
          onToggleComplete={handleToggleComplete}
          onUpdate={onUpdate}
          onDelete={setDeleteConfirm}
          onDoubleClick={handleOpenActivityDetail}
          dragHandleProps={listeners}
          allowReopen={allowReopenCompleted || isCompleting}
          quickActions={shouldShowQuickActions(activity) ? quickActions(activity) : undefined}
          completionState={isCompleting ? 'transitioning' : 'idle'}
        />
        <div className="hidden" {...attributes} />
      </div>
    );
  }

  const renderLegacyRow = (activity: Activity, sortable = false) => {
    const isCompleting = activity.id in completingActivities;

    if (sortable) {
      return <SortableLegacyActivityRow key={activity.id} activity={activity} />;
    }

    return (
      <ActivityItem
        key={activity.id}
        activity={activity}
        tags={tags}
        customFields={listFields}
        listDisplay={listDisplay}
        onToggleComplete={handleToggleComplete}
        onUpdate={onUpdate}
        onDelete={setDeleteConfirm}
        onDoubleClick={handleOpenActivityDetail}
        allowReopen={allowReopenCompleted || isCompleting}
        quickActions={shouldShowQuickActions(activity) ? quickActions(activity) : undefined}
        completionState={isCompleting ? 'transitioning' : 'idle'}
      />
    );
  };

  const overdueCount = useMemo(
    () => activities.active.filter((activity) => {
      const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
      return dueDate && dueDate < todayKey;
    }).length,
    [activities.active, todayKey]
  );
  const todayCount = useMemo(
    () => activities.active.filter((activity) => shouldShowInToday(activity, todayKey)).length,
    [activities.active, todayKey]
  );

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newActivityTitle.trim();
    if (!title) return;
    const defaults = getCreationDefaults();
    void onAdd(title, undefined, defaults);
    setNewActivityTitle('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-3">
        {/* Linha 1: título + stats + ações */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Atividades</h2>
            {!useLegacyLayout && (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  {activities.active.length} ativas
                </span>
                {todayCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" />
                    {todayCount} para hoje
                  </span>
                )}
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
                  </span>
                )}
                {waitingCount > 0 && (
                  <span className="flex items-center gap-1 text-stone-500">
                    <span>·</span>
                    {waitingCount} aguardando
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortOption} onValueChange={(value) => onSortChange(value as SortOption)}>
                  {availableSortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option}>
                      {sortLabels[option]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrar por tags</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={selectedTags.includes(tag.id)}
                    onCheckedChange={() =>
                      setSelectedTags((prev) => (prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))
                    }
                  >
                    <span className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Linha 2: criação rápida (novo visual apenas) */}
        {!useLegacyLayout && (
          <form onSubmit={handleQuickCreate} className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newActivityTitle}
                onChange={(e) => setNewActivityTitle(e.target.value)}
                placeholder="Adicionar atividade... (Enter para criar)"
                className="h-9 w-full rounded-full border border-border bg-muted/30 px-4 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {newActivityTitle.trim() && (
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-full px-4"
              onClick={() => setShowNewActivityDialog(true)}
            >
              Detalhes
            </Button>
          </form>
        )}

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              {!useLegacyLayout && onUpdateListDisplay && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={modernVisualMode === 'cards' ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => void onUpdateListDisplay({ visualMode: 'cards' })}
                  >
                    Cards
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={modernVisualMode === 'table' ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => void onUpdateListDisplay({ visualMode: 'table' })}
                  >
                    Tabela
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => {
                  return (
                    <Button key={option.id} variant={viewMode === option.id ? 'default' : 'outline'} size="sm" onClick={() => setViewMode(option.id)}>
                      {option.label}
                      <Badge variant="secondary" className="ml-2">{option.count}</Badge>
                    </Button>
                  );
                })}
              </div>
            </div>

            {useLegacyLayout && (
              <Button onClick={() => setShowNewActivityDialog(true)} className="w-full lg:w-auto lg:min-w-[180px]">
                <Plus className="mr-2 h-4 w-4" />
                Nova Atividade
              </Button>
            )}
          </div>

          {viewMode === 'projects' && (
            <div className="lg:max-w-sm">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os projetos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projectNames.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-1 border-b px-4 py-2">
          {selectedTags.map((tagId) => {
            const tag = tags.find((item) => item.id === tagId);
            if (!tag) return null;
            return (
              <Badge
                key={tagId}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setSelectedTags((prev) => prev.filter((id) => id !== tagId))}
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name} x
              </Badge>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <div className={useLegacyLayout ? 'rounded-[22px] border border-[#d8d0c4] bg-[#fbf7f1] shadow-[0_10px_35px_rgba(82,59,33,0.06)] dark:border-border dark:bg-card' : 'overflow-x-auto rounded-[22px] border border-[#d8d0c4] bg-[#fbf7f1] shadow-[0_10px_35px_rgba(82,59,33,0.06)] dark:border-border dark:bg-card'}>
          <div className="min-w-full">
            {useInlineTableLayout && (
              <div
                style={{ ['--activity-grid-template' as string]: desktopGridTemplate }}
                className="hidden items-center gap-5 border-b border-[#d8d0c4] bg-[#f3eee6] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500 dark:border-border dark:bg-muted/40 dark:text-muted-foreground md:grid md:[grid-template-columns:var(--activity-grid-template)]"
              >
                <span />
                <span />
                <span>Atividade</span>
                {tableColumns.map((column) => (
                  <span key={column.id}>{column.label}</span>
                ))}
                <span className="text-right">Acoes</span>
              </div>
            )}
            <div className={useLegacyLayout ? 'space-y-2 divide-y divide-border px-2 py-2' : undefined}>
              {canDrag ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={displayActive.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
                    {displayActive.map((activity) =>
                      useLegacyLayout
                        ? renderLegacyRow(activity, true)
                        : useInlineTableLayout
                          ? renderInlineTableRow(activity, true)
                          : renderCardsRow(activity, true)
                    )}
                  </SortableContext>
                </DndContext>
              ) : (
                displayActive.map((activity) =>
                  useLegacyLayout
                    ? renderLegacyRow(activity)
                    : useInlineTableLayout
                      ? renderInlineTableRow(activity)
                      : renderCardsRow(activity)
                )
              )}
            </div>
          </div>
        </div>

        {displayActive.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            {searchQuery ? 'Nenhuma atividade encontrada' : 'Nenhuma atividade neste recorte'}
          </div>
        )}

        {filteredCompleted.length > 0 && (
          <div className="mt-4">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowCompleted((prev) => !prev)}
            >
              {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              Concluidas ({filteredCompleted.length})
            </button>
            {showCompleted && (
              <div className="space-y-1">
                {filteredCompleted.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    tags={tags}
                    customFields={listFields}
                    listDisplay={listDisplay}
                    onToggleComplete={handleToggleComplete}
                    onUpdate={onUpdate}
                    onDelete={setDeleteConfirm}
                    onDoubleClick={handleOpenActivityDetail}
                    allowReopen={allowReopenCompleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedActivity && selectedActivityState && (
        <Suspense fallback={null}>
          <ActivityDetail
            activity={selectedActivity}
            activities={allActivities}
            tags={tags}
            customFields={customFields.filter((field) => field.enabled && (field.display === 'detail' || field.display === 'both'))}
            formLayout={listDisplay.formLayout}
            onSave={async (activityId, payload) => {
              onUpdate(activityId, {
                title: payload.title,
                tags: payload.tags,
                customFields: payload.customFields,
              });
              syncDependencies(activityId, selectedActivity.customFields, payload.customFields);
            }}
            onClose={() => setSelectedActivityState(null)}
            isReadOnly={selectedActivityState.readOnly}
          />
        </Suspense>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao pode ser desfeita. A atividade sera permanentemente removida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  onDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        <ActivityCreateDialog
          isOpen={showNewActivityDialog}
          onOpenChange={setShowNewActivityDialog}
          activities={allActivities}
          tags={tags}
          customFields={customFields}
          formLayout={listDisplay.formLayout}
          initialTitle={newActivityTitle}
          initialTags={newActivityTags}
          initialCustomFields={newActivityFields as Activity['customFields']}
          onSubmit={async ({ title, tags: selectedDialogTags, customFields: dialogFields }) => {
            setNewActivityTitle(title);
            setNewActivityTags(selectedDialogTags);
            setNewActivityFields(dialogFields);
            const nextCustomFields = {
              ...getCreationDefaults(),
              ...dialogFields,
            };
            const createdActivity = await onAdd(title, selectedDialogTags.length > 0 ? selectedDialogTags : undefined, nextCustomFields);
            if (createdActivity) {
              syncDependencies(createdActivity.id, {}, nextCustomFields);
            }
            setNewActivityTitle('');
            setNewActivityTags([]);
            setNewActivityFields({});
            setShowNewActivityDialog(false);
          }}
        />
      </Suspense>
    </div>
  );
}
