import { useMemo, useState } from 'react';
import { Activity } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, CheckCircle2, ChevronDown, Link2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createActivityRef, createTextRef, parseDependencyRef } from '@/lib/activity-meta';

interface ActivityDependencyFieldProps {
  label: string;
  values: string[];
  activities: Activity[];
  currentActivityId?: string;
  textPlaceholder: string;
  onChange: (values: string[]) => void;
  readOnly?: boolean;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function ActivityDependencyField({
  label,
  values,
  activities,
  currentActivityId,
  textPlaceholder,
  onChange,
  readOnly = false,
}: ActivityDependencyFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [freeText, setFreeText] = useState('');

  const activityOptions = useMemo(
    () => activities.filter((activity) => activity.id !== currentActivityId),
    [activities, currentActivityId]
  );

  const selectedItems = useMemo(
    () =>
      values.map((value) => {
        const parsed = parseDependencyRef(value);
        if (parsed.type === 'activity' && parsed.id) {
          const activity = activities.find((item) => item.id === parsed.id);
          return {
            raw: value,
            label: activity?.title || 'Atividade nao encontrada',
            completed: activity?.completed || false,
            type: 'activity' as const,
          };
        }

        return {
          raw: value,
          label: parsed.label,
          completed: false,
          type: 'text' as const,
        };
      }),
    [activities, values]
  );

  const toggleActivity = (activityId: string) => {
    const rawValue = createActivityRef(activityId);
    onChange(
      values.includes(rawValue)
        ? values.filter((value) => value !== rawValue)
        : uniqueValues([...values, rawValue])
    );
  };

  const removeValue = (rawValue: string) => {
    onChange(values.filter((value) => value !== rawValue));
  };

  const addFreeText = () => {
    const trimmed = freeText.trim();
    if (!trimmed) {
      return;
    }

    const rawValue = createTextRef(trimmed);
    if (!values.includes(rawValue)) {
      onChange(uniqueValues([...values, rawValue]));
    }
    setFreeText('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {!readOnly && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                Selecionar atividade
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] p-0">
              <Command>
                <CommandInput placeholder="Buscar atividade..." />
                <CommandList>
                  <CommandEmpty>Nenhuma atividade encontrada.</CommandEmpty>
                  <CommandGroup>
                    {activityOptions.map((activity) => {
                      const isSelected = values.includes(createActivityRef(activity.id));
                      return (
                        <CommandItem key={activity.id} value={`${activity.title} ${activity.completed ? 'concluida' : 'aberta'}`} onSelect={() => toggleActivity(activity.id)}>
                          <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className={cn('truncate', activity.completed && 'text-muted-foreground line-through')}>
                              {activity.title}
                            </span>
                            {activity.completed && (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                Concluida
                              </Badge>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedItems.length > 0 ? selectedItems.map((item) => (
          <Badge
            key={item.raw}
            variant="secondary"
            className={cn(
              'gap-1 px-2 py-1',
              item.type === 'activity' && item.completed && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            )}
          >
            {item.type === 'activity' ? <Link2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span className={cn(item.type === 'activity' && item.completed && 'line-through')}>
              {item.label}
            </span>
            {item.type === 'activity' && item.completed && <CheckCircle2 className="h-3.5 w-3.5" />}
            {!readOnly && (
              <button type="button" onClick={() => removeValue(item.raw)} className="ml-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        )) : (
          <span className="text-sm text-muted-foreground">Nenhum item definido.</span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addFreeText();
              }
            }}
            placeholder={textPlaceholder}
          />
          <Button type="button" variant="outline" onClick={addFreeText}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
