import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ActivityFormLayoutSettings,
  ActivityRecurrence,
  ActivitySubtask,
  CustomField,
  JsonValue,
  Tag,
} from '@/types';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Link2, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateKey, normalizeDateKey, parseDateKey } from '@/lib/date';
import { ActivityDependencyField } from './ActivityDependencyField';
import { ActivityFormLayoutBlocks } from './ActivityFormLayoutBlocks';
import { getNextFormLayoutRow } from '@/lib/activity-form-layout';
import {
  ACTIVITY_META,
  createMetaPatch,
  getLinkedNoteDates,
  getPredecessorRefs,
  getRecurrence,
  getSourceLineIds,
  getSubtasks,
  getSuccessorRefs,
} from '@/lib/activity-meta';

interface ActivityDetailProps {
  activity: Activity;
  activities: Activity[];
  tags: Tag[];
  customFields: CustomField[];
  formLayout: ActivityFormLayoutSettings;
  onSave: (activityId: string, payload: { title: string; tags: string[]; customFields: Activity['customFields'] }) => Promise<void> | void;
  onClose: () => void;
  isReadOnly?: boolean;
}

function generateId() {
  return crypto.randomUUID();
}

function subtasksToText(subtasks: ActivitySubtask[]) {
  return subtasks.map((subtask) => subtask.title).join('\n');
}

function textToSubtasks(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      return {
        id: generateId(),
        title: line,
        completed: false,
      } satisfies ActivitySubtask;
    });
}

export function ActivityDetail({
  activity,
  activities,
  tags,
  customFields,
  formLayout,
  onSave,
  onClose,
  isReadOnly = false,
}: ActivityDetailProps) {
  const [title, setTitle] = useState(activity.title);
  const [selectedTags, setSelectedTags] = useState<string[]>(activity.tags);
  const [fieldValues, setFieldValues] = useState<Record<string, JsonValue>>(activity.customFields);
  const [subtaskText, setSubtaskText] = useState(subtasksToText(getSubtasks(activity)));

  useEffect(() => {
    setTitle(activity.title);
    setSelectedTags(activity.tags);
    setFieldValues(activity.customFields);
    setSubtaskText(subtasksToText(getSubtasks(activity)));
  }, [activity]);

  const previewActivity = useMemo(
    () => ({ ...activity, title, tags: selectedTags, customFields: fieldValues }),
    [activity, fieldValues, selectedTags, title]
  );

  const dueDateField = useMemo(
    () => customFields.find((field) => field.enabled && field.key === 'dueDate' && field.display !== 'list') || null,
    [customFields]
  );
  const enabledCustomFields = useMemo(
    () => customFields.filter((field) => field.enabled && field.key !== 'dueDate' && field.display !== 'list'),
    [customFields]
  );
  const linkedNoteDates = useMemo(() => getLinkedNoteDates(previewActivity), [previewActivity]);
  const recurrence = useMemo(() => getRecurrence(previewActivity), [previewActivity]);
  const predecessorRefs = useMemo(() => getPredecessorRefs(previewActivity), [previewActivity]);
  const successorRefs = useMemo(() => getSuccessorRefs(previewActivity), [previewActivity]);
  const hasDependencies = predecessorRefs.length > 0 || successorRefs.length > 0;
  const isFavorite = fieldValues[ACTIVITY_META.favorite] === true;
  const sourceLineIds = useMemo(() => getSourceLineIds(previewActivity), [previewActivity]);
  const subtaskItems = useMemo(() => getSubtasks(previewActivity), [previewActivity]);
  const [showDependencies, setShowDependencies] = useState(hasDependencies);
  const fieldsToValidate = useMemo(
    () => (dueDateField ? [dueDateField, ...enabledCustomFields] : enabledCustomFields),
    [dueDateField, enabledCustomFields]
  );
  const effectiveLayout = useMemo(() => {
    const existingKeys = new Set(formLayout.blocks.map((block) => block.contentKey));
    const extraBlocks = [];
    let nextRow = getNextFormLayoutRow(formLayout.blocks);

    if (!existingKeys.has('title')) {
      extraBlocks.push({ id: 'required-title', contentKey: 'title', colStart: 1, rowStart: nextRow, colSpan: 12, rowSpan: 1 });
      nextRow += 1;
    }
    if (dueDateField?.required && !existingKeys.has('dueDate')) {
      extraBlocks.push({ id: 'required-due-date', contentKey: 'dueDate', colStart: 1, rowStart: nextRow, colSpan: 12, rowSpan: 1 });
      nextRow += 1;
    }

    enabledCustomFields
      .filter((field) => field.required)
      .forEach((field) => {
        const key = `field:${field.key}`;
        if (!existingKeys.has(key)) {
          extraBlocks.push({ id: `required-${field.key}`, contentKey: key, colStart: 1, rowStart: nextRow, colSpan: 12, rowSpan: 1 });
          nextRow += 1;
        }
      });

    return {
      blocks: [...extraBlocks, ...formLayout.blocks],
    };
  }, [dueDateField, enabledCustomFields, formLayout]);

  useEffect(() => {
    setShowDependencies(hasDependencies);
  }, [activity.id, hasDependencies]);

  const missingRequiredFields = useMemo(() => {
    return fieldsToValidate
      .filter((field) => field.required)
      .filter((field) => {
        const value = fieldValues[field.id] ?? fieldValues[field.key];
        if (field.type === 'boolean') {
          return value !== true && value !== false;
        }
        if (Array.isArray(value)) {
          return value.length === 0;
        }
        return value === null || value === undefined || value === '';
      })
      .map((field) => field.name);
  }, [fieldValues, fieldsToValidate]);

  const setMeta = (patch: Record<string, JsonValue>) => {
    if (isReadOnly) {
      return;
    }

    setFieldValues((prev) => ({
      ...prev,
      ...createMetaPatch(patch),
    }));
  };

  const getFieldValue = (field: CustomField) => fieldValues[field.id] ?? fieldValues[field.key];
  const setFieldValue = (field: CustomField, value: JsonValue) => {
    if (isReadOnly) {
      return;
    }

    setFieldValues((prev) => ({
      ...prev,
      [field.id]: value,
      [field.key]: value,
    }));
  };

  const toggleTag = (tagId: string) => {
    if (isReadOnly) {
      return;
    }

    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const handleSave = async () => {
    if (isReadOnly || !title.trim()) {
      onClose();
      return;
    }

    await onSave(activity.id, {
      title: title.trim(),
      tags: selectedTags,
      customFields: {
        ...fieldValues,
        [ACTIVITY_META.subtasks]: textToSubtasks(subtaskText),
      },
    });
    onClose();
  };

  const renderField = (field: CustomField) => {
    const value = getFieldValue(field);
    const normalizedDateValue = field.type === 'date' && typeof value === 'string' ? normalizeDateKey(value) : null;

    if (isReadOnly) {
      if (value === null || value === undefined || value === '') {
        return <div className="text-sm text-muted-foreground">-</div>;
      }
      if (field.type === 'boolean') {
        return <div className="text-sm text-muted-foreground">{value ? 'Sim' : 'Nao'}</div>;
      }
      if (field.type === 'date' && normalizedDateValue) {
        return <div className="text-sm text-muted-foreground">{format(parseDateKey(normalizedDateValue), 'PPP', { locale: ptBR })}</div>;
      }
      if (field.type === 'datetime' && typeof value === 'string') {
        return <div className="text-sm text-muted-foreground">{format(new Date(value), 'PPP HH:mm', { locale: ptBR })}</div>;
      }
      if (field.type === 'currency' && typeof value === 'number') {
        return <div className="text-sm text-muted-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</div>;
      }
      if (Array.isArray(value)) {
        return <div className="text-sm text-muted-foreground">{value.join(', ') || '-'}</div>;
      }
      return <div className="text-sm text-muted-foreground">{String(value)}</div>;
    }

    switch (field.type) {
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {normalizedDateValue ? format(parseDateKey(normalizedDateValue), 'PPP', { locale: ptBR }) : 'Selecionar data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={normalizedDateValue ? parseDateKey(normalizedDateValue) : undefined}
                onSelect={(date) => setFieldValue(field, date ? formatDateKey(date) : null)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={typeof value === 'string' ? value.slice(0, 16) : ''}
            onChange={(event) => setFieldValue(field, event.target.value || null)}
          />
        );

      case 'single_select':
        return (
          <Select value={typeof value === 'string' ? value : ''} onValueChange={(nextValue) => setFieldValue(field, nextValue)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi_select': {
        const selectedOptions = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => (
              <Badge
                key={option}
                variant={selectedOptions.includes(option) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  const nextValue = selectedOptions.includes(option)
                    ? selectedOptions.filter((item) => item !== option)
                    : [...selectedOptions, option];
                  setFieldValue(field, nextValue);
                }}
              >
                {option}
              </Badge>
            ))}
          </div>
        );
      }

      case 'tags': {
        const selectedOptions = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
        return (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedOptions.includes(tag.id) ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                style={
                  selectedOptions.includes(tag.id)
                    ? { backgroundColor: tag.color, borderColor: tag.color, color: 'white' }
                    : { borderColor: tag.color, color: tag.color }
                }
                onClick={() => {
                  const nextValue = selectedOptions.includes(tag.id)
                    ? selectedOptions.filter((item) => item !== tag.id)
                    : [...selectedOptions, tag.id];
                  setFieldValue(field, nextValue);
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        );
      }

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(event) => setFieldValue(field, event.target.value ? Number(event.target.value) : null)}
            step={field.type === 'currency' ? '0.01' : '1'}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={value === true}
              onCheckedChange={(checked) => setFieldValue(field, checked === true)}
            />
            <span className="text-sm">{value ? 'Sim' : 'Nao'}</span>
          </div>
        );

      case 'long_text':
        return (
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setFieldValue(field, event.target.value)}
            rows={3}
          />
        );

      case 'text':
      default:
        return (
          <Input
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => setFieldValue(field, event.target.value)}
          />
        );
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent hideCloseButton className="h-[min(85vh,900px)] w-[min(96vw,42rem)] max-w-[min(96vw,42rem)] overflow-hidden gap-0 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="min-w-0 flex-1 truncate text-base">
              {isReadOnly ? 'Visualizar atividade' : 'Detalhes da atividade'}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', isFavorite && 'text-amber-500')}
                onClick={() => setMeta({ [ACTIVITY_META.favorite]: !isFavorite })}
                disabled={isReadOnly}
              >
                <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-4">
            <ActivityFormLayoutBlocks
              layout={effectiveLayout}
              contentByKey={{
              title: (
                <div className="space-y-2">
                  <Label>Titulo</Label>
                  {isReadOnly ? (
                    <p className="text-sm">{title}</p>
                  ) : (
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                  )}
                </div>
              ),
              dueDate: dueDateField ? (
                <div className="space-y-2">
                  <Label>{dueDateField.name}</Label>
                  {renderField(dueDateField)}
                </div>
              ) : null,
              dependencies: showDependencies || !isReadOnly ? (
                <div className="space-y-3">
                  {!isReadOnly && (
                    <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">Vinculos entre atividades</div>
                        <div className="text-xs text-muted-foreground">
                          Ative apenas quando esta atividade depender de outra.
                        </div>
                      </div>
                      <Button type="button" variant={showDependencies ? 'secondary' : 'outline'} size="sm" onClick={() => setShowDependencies((prev) => !prev)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        {showDependencies ? 'Ocultar vinculos' : 'Adicionar vinculos'}
                      </Button>
                    </div>
                  )}

                  {showDependencies && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <ActivityDependencyField
                        label="Predecessoras"
                        values={predecessorRefs}
                        activities={activities}
                        currentActivityId={activity.id}
                        textPlaceholder="Digite uma predecessora livre"
                        onChange={(values) => setMeta({ [ACTIVITY_META.predecessors]: values })}
                        readOnly={isReadOnly}
                      />
                      <ActivityDependencyField
                        label="Sucessoras"
                        values={successorRefs}
                        activities={activities}
                        currentActivityId={activity.id}
                        textPlaceholder="Digite uma sucessora livre"
                        onChange={(values) => setMeta({ [ACTIVITY_META.successors]: values })}
                        readOnly={isReadOnly}
                      />
                    </div>
                  )}
                </div>
              ) : null,
              recurrence: (
                <div className="space-y-2">
                  <Label>Recorrencia</Label>
                  {isReadOnly ? (
                    <div className="text-sm text-muted-foreground">{recurrence?.frequency || '-'}</div>
                  ) : (
                    <Select
                      value={recurrence?.frequency || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          setMeta({ [ACTIVITY_META.recurrence]: null });
                          return;
                        }

                        setMeta({
                          [ACTIVITY_META.recurrence]: {
                            frequency: value,
                            interval: 1,
                          } satisfies ActivityRecurrence,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem recorrencia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem recorrencia</SelectItem>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekdays">Dias uteis</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ),
              observations: (
                <div className="space-y-2">
                  <Label>Observacoes</Label>
                  {isReadOnly ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {subtaskItems.length > 0 ? (
                        subtaskItems.map((subtask) => (
                          <div key={subtask.id}>{subtask.title}</div>
                        ))
                      ) : (
                        <div>-</div>
                      )}
                    </div>
                  ) : (
                    <Textarea
                      value={subtaskText}
                      onChange={(event) => setSubtaskText(event.target.value)}
                      rows={4}
                      placeholder="Observacoes, contexto, pontos importantes..."
                    />
                  )}
                </div>
              ),
              noteOrigin: linkedNoteDates.length > 0 || sourceLineIds.length > 0 ? (
                <div className="space-y-2">
                  <Label>Origem da nota</Label>
                  <div className="flex flex-wrap gap-2">
                    {linkedNoteDates.map((date) => (
                      <Badge key={date} variant="secondary">{date}</Badge>
                    ))}
                    {sourceLineIds.length > 0 && (
                      <Badge variant="secondary">{sourceLineIds.length} linha{sourceLineIds.length > 1 ? 's' : ''} vinculada{sourceLineIds.length > 1 ? 's' : ''}</Badge>
                    )}
                  </div>
                </div>
              ) : null,
              tags: (
                <div className="space-y-2">
                  <Label>Tags</Label>
                  {isReadOnly ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.filter((tag) => selectedTags.includes(tag.id)).length > 0 ? (
                        tags
                          .filter((tag) => selectedTags.includes(tag.id))
                          .map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="default"
                              style={{ backgroundColor: tag.color, borderColor: tag.color }}
                            >
                              {tag.name}
                            </Badge>
                          ))
                      ) : (
                        <div className="text-sm text-muted-foreground">-</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                          className={cn('transition-colors', !isReadOnly && 'cursor-pointer')}
                          style={
                            selectedTags.includes(tag.id)
                              ? { backgroundColor: tag.color, borderColor: tag.color }
                              : { borderColor: tag.color, color: tag.color }
                          }
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ),
              ...Object.fromEntries(
                enabledCustomFields.map((field) => [
                  `field:${field.key}`,
                  (
                    <div key={field.id} className="space-y-2">
                      <Label>
                        {field.name}
                        {field.required && <span className="ml-1 text-destructive">*</span>}
                      </Label>
                      {renderField(field)}
                    </div>
                  ),
                ])
              ),
              }}
            />
            {!isReadOnly && missingRequiredFields.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Preencha os campos obrigatorios: {missingRequiredFields.join(', ')}.
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t px-4 py-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {isReadOnly ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isReadOnly && <Button onClick={() => void handleSave()} disabled={missingRequiredFields.length > 0}>Salvar</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
