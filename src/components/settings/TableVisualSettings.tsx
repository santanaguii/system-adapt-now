import { useMemo, useState } from 'react';
import { ActivityListDisplaySettings, CustomField, FilterConfig, SortOption, Tag } from '@/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { isListEligibleCustomField, isProtectedCustomField } from '@/lib/custom-fields';

interface TableVisualSettingsProps {
  customFields: CustomField[];
  tags: Tag[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  defaultSort: SortOption;
  onUpdateListDisplay: (updates: Partial<ActivityListDisplaySettings>) => void;
  onUpdateFilters: (filters: FilterConfig[]) => void;
  onUpdateDefaultSort: (sort: SortOption) => void;
}

const sortOptionLabels: Record<SortOption, string> = {
  manual: 'Manual',
  dueDate_asc: 'Prazo (crescente)',
  dueDate_desc: 'Prazo (decrescente)',
  priority_asc: 'Prioridade (alta primeiro)',
  priority_desc: 'Prioridade (baixa primeiro)',
  createdAt_desc: 'Mais recentes',
  tag: 'Por tag',
  field: 'Por campo',
};

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

export function TableVisualSettingsTab({
  customFields,
  tags,
  listDisplay,
  savedFilters,
  defaultSort,
  onUpdateListDisplay,
  onUpdateFilters,
  onUpdateDefaultSort,
}: TableVisualSettingsProps) {
  const [newFilter, setNewFilter] = useState<Partial<FilterConfig>>({});

  const enabledFields = customFields.filter((field) => field.enabled);
  const listEligibleFields = enabledFields.filter(isListEligibleCustomField);
  const additionalListFields = listEligibleFields.filter((field) => !isProtectedCustomField(field));
  const dueDateFieldEnabled = listEligibleFields.some((field) => field.key === 'dueDate');
  const priorityFieldEnabled = listEligibleFields.some((field) => field.key === 'priority');

  const selectedField = enabledFields.find((field) => field.id === newFilter.fieldId);
  const availableOperators = selectedField
    ? getOperatorsForFieldType(selectedField.type)
    : ['equals', 'contains', 'isEmpty', 'isNotEmpty'] as FilterConfig['operator'][];

  const defaultSortOptions = useMemo(() => {
    const options: SortOption[] = ['manual', 'createdAt_desc'];

    if (dueDateFieldEnabled) {
      options.push('dueDate_asc', 'dueDate_desc');
    }

    if (priorityFieldEnabled) {
      options.push('priority_asc', 'priority_desc');
    }

    return options;
  }, [dueDateFieldEnabled, priorityFieldEnabled]);

  const visibilityItems = [
    {
      id: 'show-tags',
      label: 'Mostrar tags',
      description: 'Exibir tags coloridas na tabela',
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
          description: 'Exibir o indicador de prioridade na linha',
          checked: listDisplay.showPriority,
          onCheckedChange: (checked: boolean) => onUpdateListDisplay({ showPriority: checked }),
        }]
      : []),
  ];

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-medium">Visual da Tabela</h3>
        <p className="text-sm text-muted-foreground">
          Configure o que aparece nas linhas da nova visualizacao em tabela.
        </p>
      </div>

      <div className="space-y-4">
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
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-medium">Campos adicionais visiveis</Label>
            <div className="space-y-2">
              {additionalListFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">{field.name}</Label>
                    <p className="text-sm text-muted-foreground">Exibir este campo adicional na linha da atividade</p>
                  </div>
                  <Switch
                    checked={(listDisplay.visibleFieldIds || []).includes(field.id)}
                    onCheckedChange={(checked) => handleToggleFieldVisibility(field.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-medium">Ordenacao Padrao</h3>
        <p className="text-sm text-muted-foreground">
          Escolha a ordenacao inicial usada pela tabela.
        </p>

        <div className="space-y-2">
          <Label>Ordenar por</Label>
          <Select value={defaultSort} onValueChange={(value) => onUpdateDefaultSort(value as SortOption)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {defaultSortOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {sortOptionLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-medium">Filtros Automaticos</h3>
        <p className="text-sm text-muted-foreground">
          Defina filtros que entram automaticamente nessa visualizacao.
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

        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de filtro</Label>
              <Select
                value={newFilter.type}
                onValueChange={(value) => setNewFilter({ type: value as FilterConfig['type'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="field">Campo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newFilter.type === 'tag' && (
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select
                  value={newFilter.tagId}
                  onValueChange={(value) => setNewFilter((prev) => ({ ...prev, tagId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newFilter.type === 'field' && (
              <>
                <div className="space-y-2">
                  <Label>Campo</Label>
                  <Select
                    value={newFilter.fieldId}
                    onValueChange={(value) => setNewFilter((prev) => ({ ...prev, fieldId: value, operator: undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um campo" />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Operador</Label>
                  <Select
                    value={newFilter.operator}
                    onValueChange={(value) => setNewFilter((prev) => ({ ...prev, operator: value as FilterConfig['operator'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOperators.map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {operatorLabels[operator]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!['isEmpty', 'isNotEmpty'].includes(newFilter.operator || '') && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Valor</Label>
                    <Input
                      value={String(newFilter.value ?? '')}
                      onChange={(event) => setNewFilter((prev) => ({ ...prev, value: event.target.value }))}
                      placeholder="Valor do filtro"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <Button type="button" variant="outline" onClick={handleAddFilter} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar filtro
          </Button>
        </div>
      </div>
    </div>
  );
}
