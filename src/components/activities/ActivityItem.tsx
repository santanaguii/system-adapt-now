import { useState, useRef, useEffect } from 'react';
import { Activity, Tag, CustomField, ActivityListDisplaySettings } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { GripVertical, X, ChevronRight, Calendar, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

const priorityColors: Record<string, string> = {
  'Alta': 'text-destructive',
  'Média': 'text-amber-500',
  'Baixa': 'text-muted-foreground',
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(activity.title);
      setIsEditing(false);
    }
  };

  const handleToggle = () => {
    if (activity.completed && !allowReopen) return;
    onToggleComplete(activity.id);
  };

  const activityTags = tags.filter((tag) => activity.tags.includes(tag.id));
  const dueDate = activity.customFields.dueDate as string | null;
  const priority = activity.customFields.priority as string | null;

  // Filter visible fields based on listDisplay settings
  const visibleFields = customFields.filter(field => 
    listDisplay.visibleFieldIds?.includes(field.id)
  );

  return (
    <div
      className={cn(
        'activity-item group flex items-center gap-3 px-3 py-3 rounded-lg border border-transparent hover:border-border',
        activity.completed && 'activity-completed'
      )}
    >
      {!activity.completed && dragHandleProps && (
        <div {...dragHandleProps} className="drag-handle cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      
      {(activity.completed || !dragHandleProps) && (
        <div className="w-4" />
      )}

      <Checkbox
        checked={activity.completed}
        onCheckedChange={handleToggle}
        disabled={activity.completed && !allowReopen}
        className="h-5 w-5 rounded-full border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />

      <div className="flex-1 min-w-0" onClick={handleClick}>
        {isEditing && !activity.completed ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none outline-none text-foreground"
          />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={cn('truncate', activity.completed && 'line-through')}>
                {activity.title}
              </span>
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
            {((listDisplay.showDueDate && dueDate) || (listDisplay.showPriority && priority) || visibleFields.length > 0) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {listDisplay.showDueDate && dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(dueDate), 'd MMM', { locale: ptBR })}
                  </span>
                )}
                {listDisplay.showPriority && priority && (
                  <span className={cn('flex items-center gap-1', priorityColors[priority])}>
                    <Flag className="h-3 w-3" />
                    {priority}
                  </span>
                )}
                {visibleFields.map(field => {
                  const value = activity.customFields[field.id];
                  if (value === null || value === undefined || value === '') return null;
                  
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

      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(activity.id);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
