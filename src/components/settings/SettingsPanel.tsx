import { useEffect, useMemo, useState } from 'react';
import {
  ActivityCreationMode,
  ActivityListDisplaySettings,
  AppearanceSettings,
  CustomField,
  FieldType,
  FilterConfig,
  NoteTemplate,
  SortConfig,
  Tag,
} from '@/types';
import {
  Dialog,
  DialogClose,
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
import { Plus, Trash2, X } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AppearanceSettingsTab } from './AppearanceSettings';
import { ListDisplaySettingsTab } from './ListDisplaySettings';
import { ActivityFormLayoutSettingsTab } from './ActivityFormLayoutSettings';
import { NoteTemplateSettingsTab } from './NoteTemplateSettings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  customFields: CustomField[];
  tags: Tag[];
  noteTemplates: NoteTemplate[];
  activityCreationMode: ActivityCreationMode;
  allowReopenCompleted: boolean;
  autosaveEnabled: boolean;
  appearance: AppearanceSettings;
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  savedSort: SortConfig;
  onAddField: (field: Omit<CustomField, 'id'>) => Promise<CustomField | null> | CustomField | null;
  onUpdateField: (id: string, updates: Partial<CustomField>) => Promise<void> | void;
  onDeleteField: (id: string) => Promise<void> | void;
  onAddTag: (tag: Omit<Tag, 'id'>) => Promise<Tag | null> | Tag | null;
  onUpdateTag: (id: string, updates: Partial<Tag>) => Promise<void> | void;
  onDeleteTag: (id: string) => Promise<void> | void;
  onUpdateGeneralSettings: (updates: {
    activityCreationMode?: ActivityCreationMode;
    allowReopenCompleted?: boolean;
    autosaveEnabled?: boolean;
  }) => Promise<void> | void;
  onUpdateAppearance: (updates: Partial<AppearanceSettings>) => Promise<void> | void;
  onUpdateListDisplay: (updates: Partial<ActivityListDisplaySettings>) => Promise<void> | void;
  onUpdateFilters: (filters: FilterConfig[]) => Promise<void> | void;
  onUpdateSort: (sort: SortConfig) => Promise<void> | void;
  onUpdateNoteTemplates: (templates: NoteTemplate[]) => Promise<void> | void;
}

const fieldTypes: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'long_text', label: 'Texto longo' },
  { value: 'date', label: 'Data' },
  { value: 'datetime', label: 'Data e hora' },
  { value: 'number', label: 'Numero' },
  { value: 'currency', label: 'Moeda' },
  { value: 'boolean', label: 'Sim ou nao' },
  { value: 'single_select', label: 'Selecao unica' },
  { value: 'multi_select', label: 'Selecao multipla' },
  { value: 'tags', label: 'Tags' },
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

function isSelectType(type: FieldType) {
  return type === 'single_select' || type === 'multi_select';
}

function createTempField(
  name: string,
  type: FieldType,
  required: boolean,
  options: string[],
  order: number
): CustomField {
  return {
    id: `temp-field-${crypto.randomUUID()}`,
    key: name.trim().toLowerCase().replace(/\s+/g, '_'),
    name: name.trim(),
    type,
    options: isSelectType(type) ? options : undefined,
    enabled: true,
    required,
    defaultValue: null,
    validation: undefined,
    display: 'both',
    order,
  };
}

function createTempTag(name: string, color: string): Tag {
  return {
    id: `temp-tag-${crypto.randomUUID()}`,
    name: name.trim(),
    color,
  };
}

function parseOptions(value: string) {
  return value
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);
}

function isTempId(id: string) {
  return id.startsWith('temp-');
}

function shallowChanged<T extends object>(original: T, next: T) {
  return JSON.stringify(original) !== JSON.stringify(next);
}

export function SettingsPanel({
  isOpen,
  onClose,
  customFields,
  tags,
  noteTemplates,
  activityCreationMode,
  allowReopenCompleted,
  autosaveEnabled,
  appearance,
  listDisplay,
  savedFilters,
  savedSort,
  onAddField,
  onUpdateField,
  onDeleteField,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onUpdateGeneralSettings,
  onUpdateAppearance,
  onUpdateListDisplay,
  onUpdateFilters,
  onUpdateSort,
  onUpdateNoteTemplates,
}: SettingsPanelProps) {
  const [draftActivityCreationMode, setDraftActivityCreationMode] = useState<ActivityCreationMode>(activityCreationMode);
  const [draftAllowReopenCompleted, setDraftAllowReopenCompleted] = useState(allowReopenCompleted);
  const [draftAutosaveEnabled, setDraftAutosaveEnabled] = useState(autosaveEnabled);
  const [draftAppearance, setDraftAppearance] = useState<AppearanceSettings>(appearance);
  const [draftListDisplay, setDraftListDisplay] = useState<ActivityListDisplaySettings>(listDisplay);
  const [draftSavedFilters, setDraftSavedFilters] = useState<FilterConfig[]>(savedFilters);
  const [draftSavedSort, setDraftSavedSort] = useState<SortConfig>(savedSort);
  const [draftFields, setDraftFields] = useState<CustomField[]>(customFields);
  const [draftTags, setDraftTags] = useState<Tag[]>(tags);
  const [draftNoteTemplates, setDraftNoteTemplates] = useState<NoteTemplate[]>(noteTemplates);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(tagColors[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraftActivityCreationMode(activityCreationMode);
    setDraftAllowReopenCompleted(allowReopenCompleted);
    setDraftAutosaveEnabled(autosaveEnabled);
    setDraftAppearance(appearance);
    setDraftListDisplay(listDisplay);
    setDraftSavedFilters(savedFilters);
    setDraftSavedSort(savedSort);
    setDraftFields([...customFields].sort((a, b) => a.order - b.order));
    setDraftTags(tags);
    setDraftNoteTemplates(noteTemplates);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldOptions('');
    setNewFieldRequired(false);
    setNewTagName('');
    setNewTagColor(tagColors[0]);
    setIsSaving(false);
  }, [
    activityCreationMode,
    allowReopenCompleted,
    appearance,
    autosaveEnabled,
    customFields,
    isOpen,
    listDisplay,
    savedFilters,
    savedSort,
    tags,
    noteTemplates,
  ]);

  const orderedFields = useMemo(
    () => [...draftFields].sort((a, b) => a.order - b.order),
    [draftFields]
  );

  const updateDraftField = (fieldId: string, updates: Partial<CustomField>) => {
    setDraftFields((prev) =>
      prev.map((field) => {
        if (field.id !== fieldId) {
          return field;
        }

        const nextType = updates.type ?? field.type;
        return {
          ...field,
          ...updates,
          options: isSelectType(nextType) ? (updates.options ?? field.options ?? []) : undefined,
        };
      })
    );
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      return;
    }

    setDraftFields((prev) => [
      ...prev,
      createTempField(newFieldName, newFieldType, newFieldRequired, parseOptions(newFieldOptions), prev.length),
    ]);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldOptions('');
    setNewFieldRequired(false);
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) {
      return;
    }

    setDraftTags((prev) => [...prev, createTempTag(newTagName, newTagColor)]);
    setNewTagName('');
  };

  const hasChanges = useMemo(() => {
    return (
      draftActivityCreationMode !== activityCreationMode ||
      draftAllowReopenCompleted !== allowReopenCompleted ||
      draftAutosaveEnabled !== autosaveEnabled ||
      shallowChanged(draftAppearance, appearance) ||
      shallowChanged(draftListDisplay, listDisplay) ||
      shallowChanged(draftSavedFilters, savedFilters) ||
      shallowChanged(draftSavedSort, savedSort) ||
      shallowChanged(orderedFields, [...customFields].sort((a, b) => a.order - b.order)) ||
      shallowChanged(draftTags, tags) ||
      shallowChanged(draftNoteTemplates, noteTemplates)
    );
  }, [
    activityCreationMode,
    allowReopenCompleted,
    appearance,
    autosaveEnabled,
    customFields,
    draftActivityCreationMode,
    draftAllowReopenCompleted,
    draftAppearance,
    draftAutosaveEnabled,
    draftListDisplay,
    draftSavedFilters,
    draftSavedSort,
    draftTags,
    draftNoteTemplates,
    listDisplay,
    orderedFields,
    noteTemplates,
    savedFilters,
    savedSort,
    tags,
  ]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      if (
        draftActivityCreationMode !== activityCreationMode ||
        draftAllowReopenCompleted !== allowReopenCompleted ||
        draftAutosaveEnabled !== autosaveEnabled
      ) {
        await Promise.resolve(
          onUpdateGeneralSettings({
            activityCreationMode: draftActivityCreationMode,
            allowReopenCompleted: draftAllowReopenCompleted,
            autosaveEnabled: draftAutosaveEnabled,
          })
        );
      }

      if (shallowChanged(draftAppearance, appearance)) {
        await Promise.resolve(onUpdateAppearance(draftAppearance));
      }

      if (shallowChanged(draftListDisplay, listDisplay)) {
        await Promise.resolve(onUpdateListDisplay(draftListDisplay));
      }

      if (shallowChanged(draftSavedFilters, savedFilters)) {
        await Promise.resolve(onUpdateFilters(draftSavedFilters));
      }

      if (shallowChanged(draftSavedSort, savedSort)) {
        await Promise.resolve(onUpdateSort(draftSavedSort));
      }

      if (shallowChanged(draftNoteTemplates, noteTemplates)) {
        await Promise.resolve(onUpdateNoteTemplates(draftNoteTemplates));
      }

      const originalFields = [...customFields].sort((a, b) => a.order - b.order);
      const originalFieldMap = new Map(originalFields.map((field) => [field.id, field]));

      for (const field of originalFields) {
        if (!orderedFields.some((item) => item.id === field.id)) {
          await Promise.resolve(onDeleteField(field.id));
        }
      }

      for (const field of orderedFields) {
        if (isTempId(field.id)) {
          const newField: Omit<CustomField, 'id'> = {
            key: field.key,
            name: field.name,
            type: field.type,
            options: field.options,
            enabled: field.enabled,
            required: field.required,
            defaultValue: field.defaultValue,
            validation: field.validation,
            display: field.display,
            order: field.order,
          };
          await Promise.resolve(onAddField(newField));
          continue;
        }

        const original = originalFieldMap.get(field.id);
        if (!original) {
          continue;
        }

        const updates: Partial<CustomField> = {};
        if (original.name !== field.name) updates.name = field.name;
        if (original.type !== field.type) updates.type = field.type;
        if (original.enabled !== field.enabled) updates.enabled = field.enabled;
        if (original.required !== field.required) updates.required = field.required;
        if (JSON.stringify(original.options ?? []) !== JSON.stringify(field.options ?? [])) updates.options = field.options;
        if (original.order !== field.order) updates.order = field.order;

        if (Object.keys(updates).length > 0) {
          await Promise.resolve(onUpdateField(field.id, updates));
        }
      }

      const originalTagMap = new Map(tags.map((tag) => [tag.id, tag]));

      for (const tag of tags) {
        if (!draftTags.some((item) => item.id === tag.id)) {
          await Promise.resolve(onDeleteTag(tag.id));
        }
      }

      for (const tag of draftTags) {
        if (isTempId(tag.id)) {
          await Promise.resolve(onAddTag({ name: tag.name, color: tag.color }));
          continue;
        }

        const original = originalTagMap.get(tag.id);
        if (!original) {
          continue;
        }

        const updates: Partial<Tag> = {};
        if (original.name !== tag.name) updates.name = tag.name;
        if (original.color !== tag.color) updates.color = tag.color;

        if (Object.keys(updates).length > 0) {
          await Promise.resolve(onUpdateTag(tag.id, updates));
        }
      }

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton className="flex h-[min(88vh,960px)] w-[min(96vw,42rem)] max-w-[min(96vw,42rem)] flex-col overflow-hidden gap-0 p-0">
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="min-w-0 flex-1 truncate text-base">Configuracoes</DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <Tabs defaultValue="general" className="flex min-h-full flex-col gap-3">
            <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="general">Geral</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="list">Lista</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="appearance">Aparencia</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="notes">Notas</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="form">Formulario</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="fields">Campos</TabsTrigger>
              <TabsTrigger className="whitespace-normal px-2 py-2 text-xs sm:text-sm" value="tags">Tags</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0 space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-base font-medium">Modo de criacao de atividade</Label>
                  <RadioGroup
                    value={draftActivityCreationMode}
                    onValueChange={(value) => setDraftActivityCreationMode(value as ActivityCreationMode)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="simple" id="simple" />
                      <Label htmlFor="simple" className="cursor-pointer font-normal">
                        <span className="font-medium">Simples</span>
                        <span className="block text-sm text-muted-foreground">Campo de titulo e botao adicionar</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="detailed" id="detailed" />
                      <Label htmlFor="detailed" className="cursor-pointer font-normal">
                        <span className="font-medium">Detalhado</span>
                        <span className="block text-sm text-muted-foreground">Abre o formulario completo</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="font-medium">Permitir reabrir concluidas</Label>
                    <p className="text-sm text-muted-foreground">Desmarcar checkbox de atividades concluidas</p>
                  </div>
                  <Switch checked={draftAllowReopenCompleted} onCheckedChange={setDraftAllowReopenCompleted} />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <Label className="font-medium">Salvamento automatico</Label>
                    <p className="text-sm text-muted-foreground">
                      {draftAutosaveEnabled ? 'As notas sao salvas automaticamente' : 'Salvar manualmente com Ctrl+S'}
                    </p>
                  </div>
                  <Switch checked={draftAutosaveEnabled} onCheckedChange={setDraftAutosaveEnabled} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-0">
              <ListDisplaySettingsTab
                customFields={draftFields}
                tags={draftTags}
                listDisplay={draftListDisplay}
                savedFilters={draftSavedFilters}
                savedSort={draftSavedSort}
                onUpdateListDisplay={(updates) => setDraftListDisplay((prev) => ({ ...prev, ...updates }))}
                onUpdateFilters={setDraftSavedFilters}
                onUpdateSort={setDraftSavedSort}
              />
            </TabsContent>

            <TabsContent value="appearance" className="mt-0">
              <AppearanceSettingsTab appearance={draftAppearance} onUpdate={(updates) => setDraftAppearance((prev) => ({ ...prev, ...updates }))} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NoteTemplateSettingsTab templates={draftNoteTemplates} onUpdate={setDraftNoteTemplates} />
            </TabsContent>

            <TabsContent value="form" className="mt-0">
              <ActivityFormLayoutSettingsTab
                customFields={draftFields}
                layout={draftListDisplay.formLayout}
                onUpdate={(formLayout) => setDraftListDisplay((prev) => ({ ...prev, formLayout }))}
              />
            </TabsContent>

            <TabsContent value="fields" className="space-y-4">
              <div className="space-y-3">
                {orderedFields.map((field) => (
                  <div key={field.id} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(checked) => updateDraftField(field.id, { enabled: checked })}
                      />
                      <Input
                        value={field.name}
                        onChange={(event) => updateDraftField(field.id, { name: event.target.value })}
                        className="h-8 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDraftFields((prev) => prev.filter((item) => item.id !== field.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_160px]">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={field.type} onValueChange={(value) => updateDraftField(field.id, { type: value as FieldType })}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2 pt-8">
                        <Checkbox
                          id={`required-${field.id}`}
                          checked={field.required}
                          onCheckedChange={(checked) => updateDraftField(field.id, { required: checked === true })}
                        />
                        <Label htmlFor={`required-${field.id}`}>Obrigatorio</Label>
                      </div>
                    </div>

                    {isSelectType(field.type) && (
                      <div className="space-y-2">
                        <Label>Opcoes</Label>
                        <Input
                          value={field.options?.join(', ') || ''}
                          onChange={(event) => updateDraftField(field.id, { options: parseOptions(event.target.value) })}
                          placeholder="Opcao 1, Opcao 2, Opcao 3"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label className="text-base font-medium">Novo campo</Label>
                <Input placeholder="Nome do campo" value={newFieldName} onChange={(event) => setNewFieldName(event.target.value)} />
                <Select value={newFieldType} onValueChange={(value) => setNewFieldType(value as FieldType)}>
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
                    placeholder="Opcao 1, Opcao 2, Opcao 3"
                    value={newFieldOptions}
                    onChange={(event) => setNewFieldOptions(event.target.value)}
                  />
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="new-field-required" checked={newFieldRequired} onCheckedChange={(checked) => setNewFieldRequired(checked === true)} />
                  <Label htmlFor="new-field-required">Campo obrigatorio</Label>
                </div>
                <Button type="button" onClick={handleAddField} disabled={!newFieldName.trim()} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar campo
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              <div className="space-y-3">
                {draftTags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <Input
                      value={tag.name}
                      onChange={(event) =>
                        setDraftTags((prev) => prev.map((item) => (item.id === tag.id ? { ...item, name: event.target.value } : item)))
                      }
                      className="h-8 flex-1"
                    />
                    <div className="flex gap-1">
                      {tagColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            outline: tag.color === color ? '2px solid currentColor' : 'none',
                            outlineOffset: '2px',
                          }}
                          onClick={() =>
                            setDraftTags((prev) => prev.map((item) => (item.id === tag.id ? { ...item, color } : item)))
                          }
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDraftTags((prev) => prev.filter((item) => item.id !== tag.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label>Nova tag</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nome da tag" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} className="flex-1" />
                  <div className="flex gap-1">
                    {tagColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110"
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
                <Button type="button" onClick={handleAddTag} disabled={!newTagName.trim()} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar tag
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="shrink-0 border-t px-4 py-3">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={!hasChanges || isSaving}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
