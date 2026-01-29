import { useState } from 'react';
import { CustomField, Tag, FieldType, ActivityCreationMode } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  customFields: CustomField[];
  tags: Tag[];
  activityCreationMode: ActivityCreationMode;
  allowReopenCompleted: boolean;
  onAddField: (field: Omit<CustomField, 'id' | 'order'>) => void;
  onUpdateField: (id: string, updates: Partial<CustomField>) => void;
  onDeleteField: (id: string) => void;
  onAddTag: (tag: Omit<Tag, 'id'>) => void;
  onUpdateTag: (id: string, updates: Partial<Tag>) => void;
  onDeleteTag: (id: string) => void;
  onUpdateGeneralSettings: (updates: { activityCreationMode?: ActivityCreationMode; allowReopenCompleted?: boolean }) => void;
}

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'date', label: 'Data' },
  { value: 'datetime', label: 'Data e hora' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda' },
  { value: 'boolean', label: 'Sim/Não' },
  { value: 'single_select', label: 'Seleção única' },
  { value: 'multi_select', label: 'Seleção múltipla' },
];


const tagColors = [
  'hsl(35, 80%, 50%)',
  'hsl(200, 70%, 50%)',
  'hsl(0, 70%, 55%)',
  'hsl(140, 60%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(45, 80%, 50%)',
  'hsl(320, 60%, 50%)',
  'hsl(180, 60%, 45%)',
];

export function SettingsPanel({
  isOpen,
  onClose,
  customFields,
  tags,
  activityCreationMode,
  allowReopenCompleted,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onUpdateGeneralSettings,
}: SettingsPanelProps) {
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(tagColors[0]);
  const [editingFieldOptions, setEditingFieldOptions] = useState<string | null>(null);

  const handleAddField = () => {
    if (newFieldName.trim()) {
      const isSelectType = newFieldType === 'single_select' || newFieldType === 'multi_select';
      onAddField({
        key: newFieldName.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newFieldName.trim(),
        type: newFieldType,
        options: isSelectType ? newFieldOptions.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        enabled: true,
        required: newFieldRequired,
        display: 'both',
      });
      setNewFieldName('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
    }
  };

  const handleAddTag = () => {
    if (newTagName.trim()) {
      onAddTag({
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName('');
    }
  };

  const isSelectType = (type: FieldType) => type === 'single_select' || type === 'multi_select';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="fields">Campos</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Modo de criação de atividade</Label>
                <RadioGroup 
                  value={activityCreationMode} 
                  onValueChange={(v) => onUpdateGeneralSettings({ activityCreationMode: v as ActivityCreationMode })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="simple" id="simple" />
                    <Label htmlFor="simple" className="font-normal cursor-pointer">
                      <span className="font-medium">Simples</span>
                      <span className="text-muted-foreground block text-sm">Campo de título + botão adicionar</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="detailed" id="detailed" />
                    <Label htmlFor="detailed" className="font-normal cursor-pointer">
                      <span className="font-medium">Detalhado</span>
                      <span className="text-muted-foreground block text-sm">Pop-up para preencher todos os campos</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Permitir reabrir concluídas</Label>
                  <p className="text-sm text-muted-foreground">Desmarcar checkbox de atividades concluídas</p>
                </div>
                <Switch
                  checked={allowReopenCompleted}
                  onCheckedChange={(checked) => onUpdateGeneralSettings({ allowReopenCompleted: checked })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fields" className="space-y-4 mt-4">
            {/* Existing fields */}
            <div className="space-y-3">
              {customFields.sort((a, b) => a.order - b.order).map((field) => (
                <div key={field.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Switch
                      checked={field.enabled}
                      onCheckedChange={(checked) => onUpdateField(field.id, { enabled: checked })}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{field.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fieldTypes.find((t) => t.value === field.type)?.label}
                        {field.required && ' • Obrigatório'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Edit options for select fields */}
                  {isSelectType(field.type) && (
                    <div className="pl-10">
                      {editingFieldOptions === field.id ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Opções (separadas por vírgula)"
                            defaultValue={field.options?.join(', ')}
                            onBlur={(e) => {
                              onUpdateField(field.id, {
                                options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                              });
                              setEditingFieldOptions(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateField(field.id, {
                                  options: (e.target as HTMLInputElement).value.split(',').map((o) => o.trim()).filter(Boolean),
                                });
                                setEditingFieldOptions(null);
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingFieldOptions(field.id)}
                        >
                          Opções: {field.options?.join(', ') || 'Clique para editar'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new field */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-base font-medium">Novo Campo</Label>
              <Input
                placeholder="Nome do campo"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {fieldTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelectType(newFieldType) && (
                <Input
                  placeholder="Opções (separadas por vírgula)"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                />
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="required"
                  checked={newFieldRequired}
                  onCheckedChange={(checked) => setNewFieldRequired(checked as boolean)}
                />
                <Label htmlFor="required" className="text-sm">Campo obrigatório</Label>
              </div>
              <Button onClick={handleAddField} disabled={!newFieldName.trim()} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Campo
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 mt-4">
            {/* Existing tags */}
            <div className="space-y-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <Input
                    value={tag.name}
                    onChange={(e) => onUpdateTag(tag.id, { name: e.target.value })}
                    className="flex-1 h-8"
                  />
                  <div className="flex gap-1">
                    {tagColors.map((color) => (
                      <button
                        key={color}
                        className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color,
                          outline: tag.color === color ? '2px solid currentColor' : 'none',
                          outlineOffset: '2px',
                        }}
                        onClick={() => onUpdateTag(tag.id, { color })}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteTag(tag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new tag */}
            <div className="border-t pt-4 space-y-3">
              <Label>Nova Tag</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {tagColors.map((color) => (
                    <button
                      key={color}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        outline: newTagColor === color ? '2px solid currentColor' : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleAddTag} disabled={!newTagName.trim()} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Tag
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
