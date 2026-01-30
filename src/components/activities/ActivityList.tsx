import { useState, useCallback } from 'react';
import { Activity, Tag, CustomField, SortOption, ActivityCreationMode, ActivityListDisplaySettings, FilterConfig } from '@/types';
import { ActivityItem } from './ActivityItem';
import { ActivityDetail } from './ActivityDetail';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Filter, Settings, ChevronDown, ChevronUp, Search, 
  ArrowUpDown, Tag as TagIcon
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ActivityListProps {
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  onAdd: (title: string, tags?: string[]) => Promise<Activity | null> | Activity | null;
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
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
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
      />
    </div>
  );
}

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
  sortOption,
  onSortChange,
  allowReopenCompleted,
  activityCreationMode,
}: ActivityListProps) {
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewActivityDialog, setShowNewActivityDialog] = useState(false);
  const [newActivityTags, setNewActivityTags] = useState<string[]>([]);
  const [newActivityFields, setNewActivityFields] = useState<Record<string, unknown>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddActivitySimple = () => {
    if (newActivityTitle.trim()) {
      onAdd(newActivityTitle.trim(), newActivityTags.length > 0 ? newActivityTags : undefined);
      setNewActivityTitle('');
      setNewActivityTags([]);
    }
  };

  const handleAddActivityDetailed = async () => {
    if (newActivityTitle.trim()) {
      const newActivity = await onAdd(newActivityTitle.trim(), newActivityTags.length > 0 ? newActivityTags : undefined);
      if (newActivity && Object.keys(newActivityFields).length > 0) {
        onUpdate(newActivity.id, { customFields: newActivityFields as Activity['customFields'] });
      }
      setNewActivityTitle('');
      setNewActivityFields({});
      setNewActivityTags([]);
      setShowNewActivityDialog(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activityCreationMode === 'simple') {
        handleAddActivitySimple();
      } else {
        if (newActivityTitle.trim()) {
          setShowNewActivityDialog(true);
        }
      }
    }
  };

  const handlePlusClick = () => {
    if (activityCreationMode === 'simple') {
      handleAddActivitySimple();
    } else {
      if (newActivityTitle.trim()) {
        setShowNewActivityDialog(true);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = activities.active.findIndex((a) => a.id === active.id);
      const newIndex = activities.active.findIndex((a) => a.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const toggleNewActivityTag = useCallback((tagId: string) => {
    setNewActivityTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleDeleteConfirm = (id: string) => {
    setDeleteConfirm(id);
  };

  const handleDeleteExecute = () => {
    if (deleteConfirm) {
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  // Apply saved filters helper
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
          return typeof fieldValue === 'number' && 
                 typeof filter.value === 'number' && 
                 typeof filter.value2 === 'number' &&
                 fieldValue >= filter.value && fieldValue <= filter.value2;
        default:
          return true;
      }
    }
    
    return true;
  };

  // Filter activities
  const filterActivities = (items: Activity[]) => {
    let filtered = items;
    
    // Apply saved filters
    if (savedFilters && savedFilters.length > 0) {
      filtered = filtered.filter((activity) => 
        savedFilters.every((filter) => applyFilter(activity, filter))
      );
    }
    
    // Filter by manually selected tags (dropdown filter)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((a) => a.tags.some((t) => selectedTags.includes(t)));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        if (a.title.toLowerCase().includes(query)) return true;
        if (a.description?.toLowerCase().includes(query)) return true;
        for (const value of Object.values(a.customFields)) {
          if (typeof value === 'string' && value.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }
    
    return filtered;
  };

  const filteredActive = filterActivities(activities.active);
  const filteredCompleted = filterActivities(activities.completed);

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

  const listFields = customFields.filter((f) => f.enabled && (f.display === 'list' || f.display === 'both'));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Atividades</h2>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setIsSearching(!isSearching)}
          >
            <Search className="h-4 w-4" />
          </Button>
          
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter dropdown */}
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
                  onCheckedChange={() => toggleTagFilter(tag.id)}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {isSearching && (
        <div className="px-4 py-2 border-b">
          <Input
            placeholder="Buscar atividades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
            autoFocus
          />
        </div>
      )}

      {/* Filter badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 py-2 border-b">
          {selectedTags.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId);
            if (!tag) return null;
            return (
              <Badge
                key={tagId}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleTagFilter(tagId)}
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name} ×
              </Badge>
            );
          })}
        </div>
      )}

      {/* Add activity input - only show in simple mode */}
      {activityCreationMode === 'simple' ? (
        <div className="flex flex-col gap-2 px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova atividade..."
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            {/* Tag selector popover */}
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
                        variant={newActivityTags.includes(tag.id) ? "default" : "outline"}
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleNewActivityTag(tag.id)}
                        style={{
                          backgroundColor: newActivityTags.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: newActivityTags.includes(tag.id) ? 'white' : tag.color
                        }}
                      >
                        {tag.name}
                      </Badge>
                    )) : (
                      <span className="text-sm text-muted-foreground">
                        Nenhuma tag disponível
                      </span>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button size="icon" onClick={handlePlusClick} disabled={!newActivityTitle.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {/* Selected tags display */}
          {newActivityTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {newActivityTags.map((tagId) => {
                const tag = tags.find(t => t.id === tagId);
                if (!tag) return null;
                return (
                  <Badge
                    key={tagId}
                    style={{ backgroundColor: tag.color }}
                    className="text-white text-xs"
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center px-4 py-3 border-b">
          <Button onClick={() => setShowNewActivityDialog(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Nova Atividade
          </Button>
        </div>
      )}

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredActive.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {filteredActive.map((activity) => (
              <SortableActivityItem
                key={activity.id}
                activity={activity}
                tags={tags}
                customFields={listFields}
                listDisplay={listDisplay}
                onToggleComplete={onToggleComplete}
                onUpdate={onUpdate}
                onDelete={handleDeleteConfirm}
                onDoubleClick={setSelectedActivity}
                allowReopen={allowReopenCompleted}
              />
            ))}
          </SortableContext>
        </DndContext>

        {filteredActive.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {searchQuery ? 'Nenhuma atividade encontrada' : 'Nenhuma atividade pendente'}
          </div>
        )}

        {/* Completed section */}
        {filteredCompleted.length > 0 && (
          <div className="mt-4">
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              Concluídas ({filteredCompleted.length})
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
                    onToggleComplete={onToggleComplete}
                    onUpdate={onUpdate}
                    onDelete={handleDeleteConfirm}
                    onDoubleClick={setSelectedActivity}
                    allowReopen={allowReopenCompleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity detail modal */}
      {selectedActivity && (
        <ActivityDetail
          activity={selectedActivity}
          tags={tags}
          customFields={customFields.filter((f) => f.enabled && (f.display === 'detail' || f.display === 'both'))}
          onUpdate={onUpdate}
          onClose={() => setSelectedActivity(null)}
          isReadOnly={selectedActivity.completed}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A atividade será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExecute} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New activity detailed dialog */}
      <Dialog open={showNewActivityDialog} onOpenChange={setShowNewActivityDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={newActivityTitle} 
                onChange={(e) => setNewActivityTitle(e.target.value)}
                placeholder="Nome da atividade"
              />
            </div>
            
            {/* Tags section */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.length > 0 ? tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={newActivityTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleNewActivityTag(tag.id)}
                    style={{
                      backgroundColor: newActivityTags.includes(tag.id) ? tag.color : 'transparent',
                      borderColor: tag.color,
                      color: newActivityTags.includes(tag.id) ? 'white' : tag.color
                    }}
                  >
                    {tag.name}
                  </Badge>
                )) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhuma tag disponível. Crie tags nas configurações.
                  </span>
                )}
              </div>
            </div>
            {customFields.filter(f => f.enabled).map((field) => (
              <div key={field.id} className="space-y-2">
                <Label>{field.name}{field.required && ' *'}</Label>
                {field.type === 'text' && (
                  <Input
                    value={(newActivityFields[field.id] as string) || ''}
                    onChange={(e) => setNewActivityFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}
                {field.type === 'long_text' && (
                  <Textarea
                    value={(newActivityFields[field.id] as string) || ''}
                    onChange={(e) => setNewActivityFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                    rows={3}
                  />
                )}
                {field.type === 'date' && (
                  <Input
                    type="date"
                    value={(newActivityFields[field.id] as string) || ''}
                    onChange={(e) => setNewActivityFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                  />
                )}
                {field.type === 'number' && (
                  <Input
                    type="number"
                    value={(newActivityFields[field.id] as number) || ''}
                    onChange={(e) => setNewActivityFields(prev => ({ ...prev, [field.id]: parseFloat(e.target.value) }))}
                  />
                )}
                {field.type === 'single_select' && field.options && (
                  <Select
                    value={(newActivityFields[field.id] as string) || ''}
                    onValueChange={(v) => setNewActivityFields(prev => ({ ...prev, [field.id]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione ${field.name.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewActivityDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddActivityDetailed} disabled={!newActivityTitle.trim()}>
              Criar Atividade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
