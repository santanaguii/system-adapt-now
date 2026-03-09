import { useEffect, useRef, useState } from 'react';
import { Activity, ActivityListDisplaySettings, CustomField, Tag } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, Flag, GripVertical, Link2, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ACTIVITY_META, getLinkedNoteDates } from '@/lib/activity-meta';

interface ActivityItemProps {
  activity: Activity;
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Activity>) => void;
  onDelete: (id: string) => void;
  onDoubleClick: (activity: Activity) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  allowReopen?: boolean;
  quickActions?: React.ReactNode;
}

const priorityColors: Record<string, string> = {
  Alta: 'text-destructive',
  Média: 'text-amber-500',
  Media: 'text-amber-500',
  Baixa: 'text-muted-foreground',
};

export function ActivityItem({
  activity,
  tags,
  customFields,
  listDisplay,
  onToggleComplete,
  onUpdate,
  onDelete,
  onDoubleClick,
  dragHandleProps,
  allowReopen = true,
  quickActions,
}: ActivityItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(activity.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (activity.completed) {
      onDoubleClick(activity);
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick(activity);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        setIsEditing(true);
      }, 250);
    }
  };

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdate(activity.id, { title: editValue.trim() });
    } else {
      setEditValue(activity.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSave();
    } else if (event.key === 'Escape') {
      setEditValue(activity.title);
      setIsEditing(false);
    }
  };

  const handleToggle = () => {
    if (activity.completed && !allowReopen) return;
    onToggleComplete(activity.id);
  };

  const activityTags = tags.filter((tag) => activity.tags.includes(tag.id));
  const dueDate = typeof activity.customFields.dueDate === 'string' ? activity.customFields.dueDate : null;
  const priority = typeof activity.customFields.priority === 'string' ? activity.customFields.priority : null;
  const linkedNotes = getLinkedNoteDates(activity);
  const isFavorite = activity.customFields[ACTIVITY_META.favorite] === true;

  const visibleFields = customFields.filter((field) => listDisplay.visibleFieldIds?.includes(field.id));

  return (
    <div
      className={cn('activity-item group rounded-lg border border-transparent px-3 py-3 hover:border-border', activity.completed && 'activity-completed')}
      onDoubleClick={() => onDoubleClick(activity)}
    >
      <div className="flex items-center gap-3">
        {!activity.completed && dragHandleProps ? (
          <div
            {...dragHandleProps}
            className="drag-handle cursor-grab active:cursor-grabbing"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-4" />
        )}

        <Checkbox
          checked={activity.completed}
          onCheckedChange={handleToggle}
          disabled={activity.completed && !allowReopen}
          className="h-5 w-5 rounded-full border-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
          onClick={(event) => event.stopPropagation()}
        />

        <div className="min-w-0 flex-1" onClick={handleClick}>
          {isEditing && !activity.completed ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full border-none bg-transparent text-foreground outline-none"
            />
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={cn('truncate', activity.completed && 'line-through')}>{activity.title}</span>
                {isFavorite && <Star className="h-3.5 w-3.5 fill-current text-amber-500" />}
                {listDisplay.showTags && activityTags.length > 0 && (
                  <div className="flex gap-1">
                    {activityTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="tag"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {((listDisplay.showDueDate && dueDate) ||
                (listDisplay.showPriority && priority) ||
                visibleFields.length > 0 ||
                linkedNotes.length > 0) && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {listDisplay.showDueDate && dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(dueDate), 'd MMM', { locale: ptBR })}
                  </span>
                )}

                {listDisplay.showPriority && priority && (
                  <span className={cn('flex items-center gap-1', priorityColors[priority] || 'text-muted-foreground')}>
                    <Flag className="h-3 w-3" />
                    {priority}
                  </span>
                )}

                {linkedNotes.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {linkedNotes.length} nota{linkedNotes.length > 1 ? 's' : ''}
                  </span>
                )}

                {visibleFields.map((field) => {
                  const value = activity.customFields[field.id] ?? activity.customFields[field.key];
                  if (value === null || value === undefined || value === '' || typeof value === 'object') {
                    return null;
                  }

                  let displayValue = String(value);
                  if (field.type === 'date' && typeof value === 'string') {
                    displayValue = format(new Date(value), 'd MMM', { locale: ptBR });
                  } else if (field.type === 'boolean') {
                    displayValue = value ? 'Sim' : 'Não';
                  } else if (field.type === 'currency' && typeof value === 'number') {
                    displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                  }

                  return (
                    <span key={field.id} className="flex items-center gap-1">
                      <span className="font-medium">{field.name}:</span> {displayValue}
                    </span>
                  );
                })}
              </div>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }
            onDoubleClick(activity);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          title="Abrir detalhes"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(activity.id);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {quickActions && !activity.completed && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-10" onDoubleClick={(event) => event.stopPropagation()}>
          {quickActions}
        </div>
      )}
    </div>
  );
}
