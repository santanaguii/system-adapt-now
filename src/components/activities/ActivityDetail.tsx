import { useState, useEffect } from 'react';
import { Activity, Tag, CustomField, FieldType } from '@/types';
import {
  Dialog,
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
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityDetailProps {
  activity: Activity;
  tags: Tag[];
  customFields: CustomField[];
  onUpdate: (id: string, updates: Partial<Activity>) => void;
  onClose: () => void;
  isReadOnly?: boolean;
}

export function ActivityDetail({
  activity,
  tags,
  customFields,
  onUpdate,
  onClose,
  isReadOnly = false,
}: ActivityDetailProps) {
  const [title, setTitle] = useState(activity.title);
  const [selectedTags, setSelectedTags] = useState<string[]>(activity.tags);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean | Date | string[] | null>>(
    activity.customFields
  );

  useEffect(() => {
    setTitle(activity.title);
    setSelectedTags(activity.tags);
    setFieldValues(activity.customFields);
  }, [activity]);

  const handleSave = () => {
    if (isReadOnly) return;
    onUpdate(activity.id, {
      title,
      tags: selectedTags,
      customFields: fieldValues,
    });
    onClose();
  };

  const toggleTag = (tagId: string) => {
    if (isReadOnly) return;
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const renderField = (field: CustomField) => {
    const value = fieldValues[field.id];

    if (isReadOnly) {
      return (
        <div className="text-sm text-muted-foreground">
          {renderReadOnlyValue(field, value)}
        </div>
      );
    }

    switch (field.type) {
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !value && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value as string), 'PPP', { locale: ptBR }) : 'Selecionar data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) =>
                  setFieldValues((prev) => ({ ...prev, [field.id]: date?.toISOString() || null }))
                }
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        );

      case 'datetime':
        return (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'flex-1 justify-start text-left font-normal',
                    !value && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value as string), 'PPP HH:mm', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value as string) : undefined}
                  onSelect={(date) =>
                    setFieldValues((prev) => ({ ...prev, [field.id]: date?.toISOString() || null }))
                  }
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'single_select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => setFieldValues((prev) => ({ ...prev, [field.id]: v }))}
          >
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

      case 'multi_select':
        const selectedOptions = (value as string[]) || [];
        return (
          <div className="flex flex-wrap gap-2">
            {field.options?.map((option) => (
              <Badge
                key={option}
                variant={selectedOptions.includes(option) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => {
                  const newValue = selectedOptions.includes(option)
                    ? selectedOptions.filter((o) => o !== option)
                    : [...selectedOptions, option];
                  setFieldValues((prev) => ({ ...prev, [field.id]: newValue }));
                }}
              >
                {option}
              </Badge>
            ))}
          </div>
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) =>
              setFieldValues((prev) => ({ 
                ...prev, 
                [field.id]: e.target.value ? Number(e.target.value) : null 
              }))
            }
            step={field.type === 'currency' ? '0.01' : '1'}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={(value as boolean) || false}
              onCheckedChange={(checked) =>
                setFieldValues((prev) => ({ ...prev, [field.id]: checked }))
              }
            />
            <span className="text-sm">{value ? 'Sim' : 'Não'}</span>
          </div>
        );

      case 'long_text':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            rows={3}
          />
        );

      case 'text':
      default:
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
          />
        );
    }
  };

  const renderReadOnlyValue = (field: CustomField, value: unknown): string => {
    if (value === null || value === undefined) return '-';
    
    switch (field.type) {
      case 'date':
      case 'datetime':
        return format(new Date(value as string), field.type === 'datetime' ? 'PPP HH:mm' : 'PPP', { locale: ptBR });
      case 'boolean':
        return value ? 'Sim' : 'Não';
      case 'currency':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value as number);
      case 'multi_select':
        return (value as string[]).join(', ');
      default:
        return String(value);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly ? 'Visualizar Atividade' : 'Detalhes da Atividade'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Título</Label>
            {isReadOnly ? (
              <p className="text-sm">{title}</p>
            ) : (
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
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
          </div>

          {/* Custom fields */}
          {customFields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label>
                {field.name}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </Button>
          {!isReadOnly && <Button onClick={handleSave}>Salvar</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
