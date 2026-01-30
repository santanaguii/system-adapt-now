import { CustomField, ActivityListDisplaySettings, Tag, FilterConfig, SortConfig } from '@/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
  contains: 'Contém',
  gt: 'Maior que',
  lt: 'Menor que',
  gte: 'Maior ou igual a',
  lte: 'Menor ou igual a',
  between: 'Entre',
  isEmpty: 'Está vazio',
  isNotEmpty: 'Não está vazio',
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

  const enabledFields = customFields.filter(f => f.enabled);

  const handleToggleFieldVisibility = (fieldId: string, visible: boolean) => {
    const currentVisible = listDisplay.visibleFieldIds || [];
    const newVisible = visible
      ? [...currentVisible, fieldId]
      : currentVisible.filter(id => id !== fieldId);
    onUpdateListDisplay({ visibleFieldIds: newVisible });
  };

  const handleAddFilter = () => {
    if (!newFilter.type) return;
    
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
    const newFilters = savedFilters.filter((_, i) => i !== index);
    onUpdateFilters(newFilters);
  };

  const selectedField = enabledFields.find(f => f.id === newFilter.fieldId);
  const availableOperators = selectedField 
    ? getOperatorsForFieldType(selectedField.type)
    : ['equals', 'contains', 'isEmpty', 'isNotEmpty'] as FilterConfig['operator'][];

  return (
    <div className="space-y-6">
      {/* Display Settings Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Exibição na Lista</h3>
        <p className="text-sm text-muted-foreground">
          Escolha quais informações aparecem nas atividades na visualização em lista.
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">Mostrar Tags</Label>
              <p className="text-sm text-muted-foreground">Exibir tags coloridas</p>
            </div>
            <Switch
              checked={listDisplay.showTags}
              onCheckedChange={(checked) => onUpdateListDisplay({ showTags: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">Mostrar Data de Prazo</Label>
              <p className="text-sm text-muted-foreground">Exibir prazo quando definido</p>
            </div>
            <Switch
              checked={listDisplay.showDueDate}
              onCheckedChange={(checked) => onUpdateListDisplay({ showDueDate: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">Mostrar Prioridade</Label>
              <p className="text-sm text-muted-foreground">Exibir indicador de prioridade</p>
            </div>
            <Switch
              checked={listDisplay.showPriority}
              onCheckedChange={(checked) => onUpdateListDisplay({ showPriority: checked })}
            />
          </div>
        </div>

        {/* Custom Fields Visibility */}
        {enabledFields.length > 0 && (
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Campos Personalizados Visíveis</Label>
            <div className="space-y-2">
              {enabledFields.map(field => (
                <div key={field.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`field-${field.id}`}
                    checked={(listDisplay.visibleFieldIds || []).includes(field.id)}
                    onCheckedChange={(checked) => handleToggleFieldVisibility(field.id, checked as boolean)}
                  />
                  <Label htmlFor={`field-${field.id}`} className="font-normal cursor-pointer">
                    {field.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Sort Settings Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Ordenação Padrão</h3>
        <p className="text-sm text-muted-foreground">
          Configure a ordenação padrão das atividades.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Ordenar por</Label>
            <Select 
              value={savedSort.type} 
              onValueChange={(v) => onUpdateSort({ ...savedSort, type: v as SortConfig['type'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="createdAt">Data de Criação</SelectItem>
                {enabledFields.filter(f => ['date', 'datetime', 'number', 'currency', 'single_select'].includes(f.type)).map(field => (
                  <SelectItem key={field.id} value={`field:${field.id}`}>
                    {field.name}
                  </SelectItem>
                ))}
                {tags.length > 0 && <SelectItem value="tag">Por Tag</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Direção</Label>
            <Select 
              value={savedSort.direction} 
              onValueChange={(v) => onUpdateSort({ ...savedSort, direction: v as 'asc' | 'desc' })}
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

      {/* Filter Settings Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium">Filtros Salvos</h3>
        <p className="text-sm text-muted-foreground">
          Configure filtros que serão aplicados automaticamente.
        </p>

        {/* Existing Filters */}
        {savedFilters.length > 0 && (
          <div className="space-y-2">
            {savedFilters.map((filter, index) => {
              const field = enabledFields.find(f => f.id === filter.fieldId);
              const tag = tags.find(t => t.id === filter.tagId);
              
              return (
                <div key={index} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                  <span className="flex-1 text-sm">
                    {filter.type === 'tag' ? `Tag: ${tag?.name || 'Desconhecida'}` : `Campo: ${field?.name || 'Desconhecido'}`}
                    {' '}
                    <span className="text-muted-foreground">
                      {operatorLabels[filter.operator]}
                    </span>
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

        {/* Add New Filter */}
        <div className="space-y-3 p-3 rounded-lg border">
          <Label className="text-sm font-medium">Novo Filtro</Label>
          
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={newFilter.type || ''}
              onValueChange={(v) => setNewFilter({ type: v as 'tag' | 'field', operator: 'equals' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tag">Por Tag</SelectItem>
                <SelectItem value="field">Por Campo</SelectItem>
              </SelectContent>
            </Select>

            {newFilter.type === 'tag' && (
              <Select
                value={newFilter.tagId || ''}
                onValueChange={(v) => setNewFilter({ ...newFilter, tagId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {newFilter.type === 'field' && (
              <Select
                value={newFilter.fieldId || ''}
                onValueChange={(v) => setNewFilter({ ...newFilter, fieldId: v, operator: 'equals' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Campo" />
                </SelectTrigger>
                <SelectContent>
                  {enabledFields.map(field => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {(newFilter.type === 'field' && newFilter.fieldId) && (
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newFilter.operator || 'equals'}
                onValueChange={(v) => setNewFilter({ ...newFilter, operator: v as FilterConfig['operator'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Operador" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.map(op => (
                    <SelectItem key={op} value={op}>
                      {operatorLabels[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!['isEmpty', 'isNotEmpty'].includes(newFilter.operator || '') && (
                selectedField?.type === 'single_select' && selectedField.options ? (
                  <Select
                    value={(newFilter.value as string) || ''}
                    onValueChange={(v) => setNewFilter({ ...newFilter, value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valor" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedField.options.map(opt => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : selectedField?.type === 'boolean' ? (
                  <Select
                    value={String(newFilter.value) || ''}
                    onValueChange={(v) => setNewFilter({ ...newFilter, value: v === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Valor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Sim</SelectItem>
                      <SelectItem value="false">Não</SelectItem>
                    </SelectContent>
                  </Select>
                ) : selectedField?.type === 'date' || selectedField?.type === 'datetime' ? (
                  <Input
                    type="date"
                    value={(newFilter.value as string) || ''}
                    onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                  />
                ) : selectedField?.type === 'number' || selectedField?.type === 'currency' ? (
                  <Input
                    type="number"
                    placeholder="Valor"
                    value={(newFilter.value as number) || ''}
                    onChange={(e) => setNewFilter({ ...newFilter, value: parseFloat(e.target.value) })}
                  />
                ) : (
                  <Input
                    placeholder="Valor"
                    value={(newFilter.value as string) || ''}
                    onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
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
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Filtro
          </Button>
        </div>
      </div>
    </div>
  );
}