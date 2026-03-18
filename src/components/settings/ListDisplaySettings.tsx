import { useState } from 'react';
import { CustomField, ActivityListDisplaySettings, Tag, FilterConfig, SortConfig } from '@/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { isListEligibleCustomField, isProtectedCustomField } from '@/lib/custom-fields';

interface ListDisplaySettingsProps {
  customFields: CustomField[];
  tags: Tag[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  savedSort: SortConfig;
  onUpdateListDisplay: (updates: Partial<ActivityListDisplaySettings>) => void;
  onUpdateFilters: (filters: FilterConfig[]) => void;
  onUpdateSort: (sort: SortConfig) => void;
}

const operatorLabels: Record<FilterConfig['operator'], string> = {
  equals: 'Igual a',
  contains: 'Contem',
  gt: 'Maior que',
  lt: 'Menor que',
  gte: 'Maior ou igual a',
  lte: 'Menor ou igual a',
  between: 'Entre',
  isEmpty: 'Esta vazio',
  isNotEmpty: 'Nao esta vazio',
};

function getOperatorsForFieldType(type: string): FilterConfig['operator'][] {
  switch (type) {
    case 'number':
    case 'currency':
      return ['equals', 'gt', 'lt', 'gte', 'lte', 'between', 'isEmpty', 'isNotEmpty'];
    case 'date':
    case 'datetime':
      return ['equals', 'gt', 'lt', 'gte', 'lte', 'between', 'isEmpty', 'isNotEmpty'];
    case 'text':
    case 'long_text':
      return ['equals', 'contains', 'isEmpty', 'isNotEmpty'];
    case 'boolean':
      return ['equals'];
    case 'single_select':
    case 'multi_select':
      return ['equals', 'contains', 'isEmpty', 'isNotEmpty'];
    default:
      return ['equals', 'contains', 'isEmpty', 'isNotEmpty'];
  }
}

export function ListDisplaySettingsTab({
  customFields,
  tags,
  listDisplay,
  savedFilters,
  savedSort,
  onUpdateListDisplay,
  onUpdateFilters,
  onUpdateSort,
}: ListDisplaySettingsProps) {
  const [newFilter, setNewFilter] = useState<Partial<FilterConfig>>({});

  const enabledFields = customFields.filter((field) => field.enabled);
  const listEligibleFields = enabledFields.filter(isListEligibleCustomField);
  const additionalListFields = listEligibleFields.filter((field) => !isProtectedCustomField(field));
  const dueDateFieldEnabled = listEligibleFields.some((field) => field.key === 'dueDate');
  const priorityFieldEnabled = listEligibleFields.some((field) => field.key === 'priority');

  const handleToggleFieldVisibility = (fieldId: string, visible: boolean) => {
    const currentVisible = listDisplay.visibleFieldIds || [];
    const visibleFieldIds = visible
      ? [...currentVisible, fieldId]
      : currentVisible.filter((id) => id !== fieldId);

    onUpdateListDisplay({ visibleFieldIds });
  };

  const handleAddFilter = () => {
    if (!newFilter.type) {
      return;
    }

    const filter: FilterConfig = {
      type: newFilter.type,
      fieldId: newFilter.fieldId,
      tagId: newFilter.tagId,
      operator: newFilter.operator || 'equals',
      value: newFilter.value,
    };

    onUpdateFilters([...savedFilters, filter]);
    setNewFilter({});
  };

  const handleRemoveFilter = (index: number) => {
    onUpdateFilters(savedFilters.filter((_, currentIndex) => currentIndex !== index));
  };

  const selectedField = enabledFields.find((field) => field.id === newFilter.fieldId);
  const availableOperators = selectedField
    ? getOperatorsForFieldType(selectedField.type)
    : ['equals', 'contains', 'isEmpty', 'isNotEmpty'] as FilterConfig['operator'][];

  const visibilityItems = [
    {
      id: 'show-tags',
      label: 'Mostrar tags',
      description: 'Exibir tags coloridas na lista',
      checked: listDisplay.showTags,
      onCheckedChange: (checked: boolean) => onUpdateListDisplay({ showTags: checked }),
    },
    ...(dueDateFieldEnabled
      ? [{
          id: 'show-due-date',
          label: 'Mostrar data de prazo',
          description: 'Exibir prazo quando definido',
          checked: listDisplay.showDueDate,
          onCheckedChange: (checked: boolean) => onUpdateListDisplay({ showDueDate: checked }),
        }]
      : []),
    ...(priorityFieldEnabled
      ? [{
          id: 'show-priority',
          label: 'Mostrar prioridade',
          description: 'Exibir indicador de prioridade',
          checked: listDisplay.showPriority,
          onCheckedChange: (checked: boolean) => onUpdateListDisplay({ showPriority: checked }),
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-base font-medium">Exibicao na Lista</h3>
        <p className="text-sm text-muted-foreground">
          Escolha quais informacoes aparecem nas atividades na visualizacao em lista.
        </p>

        <div className="space-y-3">
          {visibilityItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2">
              <div>
                <Label className="font-medium">{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch checked={item.checked} onCheckedChange={item.onCheckedChange} />
            </div>
          ))}
        </div>

        {additionalListFields.length > 0 && (
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Campos adicionais visiveis</Label>
            <div className="space-y-2">
              {additionalListFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">{field.name}</Label>
                    <p className="text-sm text-muted-foreground">Exibir este campo na lista de atividades</p>
                  </div>
                  <Switch
                    checked={(listDisplay.visibleFieldIds || []).includes(field.id)}
                    onCheckedChange={(checked) => handleToggleFieldVisibility(field.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-medium">Ordenacao Padrao</h3>
        <p className="text-sm text-muted-foreground">
          Configure a ordenacao padrao das atividades.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordenar por</Label>
            <Select
              value={savedSort.type}
              onValueChange={(value) => onUpdateSort({ ...savedSort, type: value as SortConfig['type'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="createdAt">Data de criacao</SelectItem>
                {enabledFields
                  .filter((field) => ['date', 'datetime', 'number', 'currency', 'single_select'].includes(field.type))
                  .map((field) => (
                    <SelectItem key={field.id} value={`field:${field.id}`}>
                      {field.name}
                    </SelectItem>
                  ))}
                {tags.length > 0 && <SelectItem value="tag">Por tag</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Direcao</Label>
            <Select
              value={savedSort.direction}
              onValueChange={(value) => onUpdateSort({ ...savedSort, direction: value as 'asc' | 'desc' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Crescente</SelectItem>
                <SelectItem value="desc">Decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-medium">Filtros Salvos</h3>
        <p className="text-sm text-muted-foreground">
          Configure filtros que serao aplicados automaticamente.
        </p>

        {savedFilters.length > 0 && (
          <div className="space-y-2">
            {savedFilters.map((filter, index) => {
              const field = enabledFields.find((item) => item.id === filter.fieldId);
              const tag = tags.find((item) => item.id === filter.tagId);

              return (
                <div key={index} className="flex items-center gap-2 rounded bg-muted/50 p-2">
                  <span className="flex-1 text-sm">
                    {filter.type === 'tag' ? `Tag: ${tag?.name || 'Desconhecida'}` : `Campo: ${field?.name || 'Desconhecido'}`}{' '}
                    <span className="text-muted-foreground">{operatorLabels[filter.operator]}</span>
                    {filter.value !== undefined && ` "${filter.value}"`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveFilter(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 rounded-lg border p-3">
          <Label className="text-sm font-medium">Novo filtro</Label>

          <div className="grid grid-cols-2 gap-2">
            <Select
              value={newFilter.type || ''}
              onValueChange={(value) => setNewFilter({ type: value as 'tag' | 'field', operator: 'equals' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tag">Por tag</SelectItem>
                <SelectItem value="field">Por campo</SelectItem>
              </SelectContent>
            </Select>

            {newFilter.type === 'tag' && (
              <Select
                value={newFilter.tagId || ''}
                onValueChange={(value) => setNewFilter({ ...newFilter, tagId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {newFilter.type === 'field' && (
              <Select
                value={newFilter.fieldId || ''}
                onValueChange={(value) => setNewFilter({ ...newFilter, fieldId: value, operator: 'equals' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar campo" />
                </SelectTrigger>
                <SelectContent>
                  {enabledFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {newFilter.type === 'field' && newFilter.fieldId && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newFilter.operator || 'equals'}
                onValueChange={(value) => setNewFilter({ ...newFilter, operator: value as FilterConfig['operator'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Operador" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map((operator) => (
                    <SelectItem key={operator} value={operator}>
                      {operatorLabels[operator]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!['isEmpty', 'isNotEmpty'].includes(newFilter.operator || '') && (
                selectedField?.type === 'single_select' && selectedField.options ? (
                  <Select
                    value={(newFilter.value as string) || ''}
                    onValueChange={(value) => setNewFilter({ ...newFilter, value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valor" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedField.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : selectedField?.type === 'boolean' ? (
                  <Select
                    value={String(newFilter.value) || ''}
                    onValueChange={(value) => setNewFilter({ ...newFilter, value: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                ) : selectedField?.type === 'date' || selectedField?.type === 'datetime' ? (
                  <Input
                    type="date"
                    value={(newFilter.value as string) || ''}
                    onChange={(event) => setNewFilter({ ...newFilter, value: event.target.value })}
                  />
                ) : selectedField?.type === 'number' || selectedField?.type === 'currency' ? (
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={(newFilter.value as number) || ''}
                    onChange={(event) => setNewFilter({ ...newFilter, value: parseFloat(event.target.value) })}
                  />
                ) : (
                  <Input
                    placeholder="Valor"
                    value={(newFilter.value as string) || ''}
                    onChange={(event) => setNewFilter({ ...newFilter, value: event.target.value })}
                  />
                )
              )}
            </div>
          )}

          <Button
            onClick={handleAddFilter}
            disabled={!newFilter.type || (newFilter.type === 'field' && !newFilter.fieldId) || (newFilter.type === 'tag' && !newFilter.tagId)}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar filtro
          </Button>
        </div>
      </div>
    </div>
  );
}
