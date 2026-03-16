import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Tag, CustomField, SortOption, ActivityCreationMode, ActivityListDisplaySettings, FilterConfig } from '@/types';
import { ActivityItem } from './ActivityItem';
import { ActivitySchedule } from './ActivitySchedule';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Filter, Settings, ChevronDown, ChevronUp, Search, ArrowUpDown, Tag as TagIcon, CalendarClock, Inbox, CalendarRange, ListTodo } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { addDaysToDateKey, endOfMonthDateKey, getDateKeyInTimeZone } from '@/lib/date';

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
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  allowReopenCompleted: boolean;
  activityCreationMode: ActivityCreationMode;
}

interface SelectedActivityState {
  id: string;
  readOnly: boolean;
}

function SortableActivityItem({
  activity,
  tags,
  customFields,
  listDisplay,
  onToggleComplete,
  onUpdate,
  onDelete,
  onDoubleClick,
  allowReopen,
  quickActions,
  completionState,
}: {
  activity: Activity;
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Activity>) => void;
  onDelete: (id: string) => void;
  onDoubleClick: (activity: Activity) => void;
  allowReopen: boolean;
  quickActions?: React.ReactNode;
  completionState?: 'idle' | 'transitioning';
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
    >
      <ActivityItem
        activity={activity}
        tags={tags}
        customFields={customFields}
        listDisplay={listDisplay}
        onToggleComplete={onToggleComplete}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDoubleClick={onDoubleClick}
        dragHandleProps={listeners}
        allowReopen={allowReopen}
        quickActions={quickActions}
        completionState={completionState}
      />
    </div>
  );
}

function getRelevantDate(activity: Activity) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? activity.customFields.dueDate : null;
  return dueDate || getScheduledDate(activity);
}

export function ActivityList({
  currentDate,
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
  sortOption,
  onSortChange,
  allowReopenCompleted,
  activityCreationMode,
}: ActivityListProps) {
  const [panelMode, setPanelMode] = useState<'list' | 'schedule'>('list');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivityState, setSelectedActivityState] = useState<SelectedActivityState | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewActivityDialog, setShowNewActivityDialog] = useState(false);
  const [newActivityTags, setNewActivityTags] = useState<string[]>([]);
  const [newActivityFields, setNewActivityFields] = useState<Record<string, unknown>>({});
  const [viewMode, setViewMode] = useState<ActivityViewMode>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleAddActivitySimple = async () => {
    if (!newActivityTitle.trim()) return;
    setIsSubmitting(true);
    await onAdd(newActivityTitle.trim(), newActivityTags.length > 0 ? newActivityTags : undefined, getCreationDefaults());
    setNewActivityTitle('');
    setNewActivityTags([]);
    setIsSubmitting(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
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
    return () => {
      completionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      completionTimeoutsRef.current.clear();
    };
  }, []);

  const waitingCount = activities.active.filter((activity) => Boolean(getBlockedBy(activity))).length;
  const backlogCount = activities.active.filter((activity) => {
    const relevantDate = getRelevantDate(activity);
    const blockedBy = getBlockedBy(activity);
    const bucket = getActivityBucket(activity);
    return bucket === 'someday' || bucket === 'inbox' || (!relevantDate && !blockedBy);
  }).length;

  const viewOptions: Array<{ id: ActivityViewMode; label: string; count: number; icon: typeof Inbox }> = [
    { id: 'all', label: 'Todas', count: activities.active.length, icon: Inbox },
    { id: 'today', label: 'Hoje', count: activities.active.filter((activity) => shouldShowInToday(activity, todayKey)).length, icon: CalendarClock },
    { id: 'week', label: 'Semana', count: activities.active.filter((activity) => { const relevantDate = getRelevantDate(activity); return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= nextWeekKey; }).length, icon: CalendarClock },
    { id: 'month', label: 'Mes', count: activities.active.filter((activity) => { const relevantDate = getRelevantDate(activity); return Boolean(relevantDate) && relevantDate >= todayKey && relevantDate <= monthEndKey; }).length, icon: CalendarClock },
    { id: 'backlog', label: 'S/data', count: backlogCount, icon: Inbox },
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

  const quickActions = (activity: Activity) => (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
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
        className="h-7 px-2 text-xs"
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
        className="h-7 px-2 text-xs"
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
        className="h-7 px-2 text-xs"
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

  const shouldShowQuickDateActions = (activity: Activity) => {
    const relevantDate = getRelevantDate(activity);
    return !relevantDate || relevantDate <= todayKey;
  };

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

  const handleOpenCalendarActivityDetail = useCallback((activity: Activity) => {
    setSelectedActivityState({
      id: activity.id,
      readOnly: true,
    });
  }, []);

  const renderActivity = (activity: Activity, sortable = false) => {
    const isCompleting = activity.id in completingActivities;

    if (sortable) {
      return (
        <SortableActivityItem
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
          quickActions={shouldShowQuickDateActions(activity) ? quickActions(activity) : undefined}
          completionState={isCompleting ? 'transitioning' : 'idle'}
        />
      );
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
        quickActions={shouldShowQuickDateActions(activity) ? quickActions(activity) : undefined}
        completionState={isCompleting ? 'transitioning' : 'idle'}
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Atividades</h2>
            <Tabs value={panelMode} onValueChange={(value) => setPanelMode(value as 'list' | 'schedule')}>
              <TabsList className="h-8">
                <TabsTrigger value="list" className="gap-1 px-2.5 text-xs">
                  <ListTodo className="h-3.5 w-3.5" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="schedule" className="gap-1 px-2.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Cronograma
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-1">
            {panelMode === 'list' && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSearching((prev) => !prev)}>
                  <Search className="h-4 w-4" />
                </Button>
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
                      {Object.entries(sortLabels).map(([value, label]) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                          {label}
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
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {panelMode === 'list' && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {viewOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Button key={option.id} variant={viewMode === option.id ? 'default' : 'outline'} size="sm" onClick={() => setViewMode(option.id)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {option.label}
                    <Badge variant="secondary" className="ml-2">{option.count}</Badge>
                  </Button>
                );
              })}
            </div>

            {viewMode === 'projects' && (
              <div className="mt-3">
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
          </>
        )}
      </div>

      {panelMode === 'list' && isSearching && (
        <div className="shrink-0 border-b px-4 py-2">
          <Input placeholder="Buscar atividades, projetos, bloqueios..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8" autoFocus />
        </div>
      )}

      {panelMode === 'list' && selectedTags.length > 0 && (
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

      {panelMode === 'list' && (activityCreationMode === 'simple' ? (
        <div className="shrink-0 flex flex-col gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova atividade..."
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleAddActivitySimple();
                }
              }}
              className="flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <TagIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selecionar tags</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.length > 0 ? tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={newActivityTags.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        onClick={() => setNewActivityTags((prev) => (prev.includes(tag.id) ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]))}
                        style={{
                          backgroundColor: newActivityTags.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: newActivityTags.includes(tag.id) ? 'white' : tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    )) : (
                      <span className="text-sm text-muted-foreground">Nenhuma tag disponivel</span>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" onClick={() => void handleAddActivitySimple()} disabled={!newActivityTitle.trim() || isSubmitting}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-1">Nova tarefa entra em: {viewOptions.find((option) => option.id === viewMode)?.label}</span>
            {selectedProject !== 'all' && <span className="rounded-full border px-2 py-1">Projeto: {selectedProject}</span>}
          </div>
        </div>
      ) : (
        <div className="shrink-0 flex items-center justify-center border-b px-4 py-3">
          <Button onClick={() => setShowNewActivityDialog(true)} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Nova Atividade
          </Button>
        </div>
      ))}

      {panelMode === 'schedule' ? (
        <ActivitySchedule
          currentDate={currentDate}
          activeActivities={activities.active}
          allActivities={allActivities}
          onOpenActivity={handleOpenCalendarActivityDetail}
          onToggleComplete={handleToggleComplete}
        />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {viewMode === 'projects' && selectedProject === 'all' ? (
          <div className="space-y-4">
            {projectNames.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum projeto associado ainda.</div>
            ) : (
              projectNames.map((project) => {
                const projectActivities = displayActive.filter((activity) => getProjectName(activity) === project);
                if (projectActivities.length === 0) return null;
                return (
                  <div key={project} className="space-y-2">
                    <div className="sticky top-0 z-10 rounded-md bg-background/95 px-3 py-2 text-sm font-semibold backdrop-blur">
                      {project} <span className="text-muted-foreground">({projectActivities.length})</span>
                    </div>
                    {projectActivities.map((activity) => renderActivity(activity))}
                  </div>
                );
              })
            )}
          </div>
        ) : canDrag ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayActive.map((activity) => activity.id)} strategy={verticalListSortingStrategy}>
              {displayActive.map((activity) => renderActivity(activity, true))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-1">
            {displayActive.map((activity) => renderActivity(activity))}
          </div>
        )}

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
      )}

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
