import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import { AppSettings, AppVisualMode, CustomField, Tag, SortOption, ActivityCreationMode, ActivityListDisplaySettings, FilterConfig, SortConfig, NoteTemplate, LayoutSettings } from '@/types';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  defaultLayoutSettings,
  defaultListDisplay,
  defaultSortConfig,
  normalizeLayoutSettings,
  normalizeListDisplaySettings,
  normalizeQuickRescheduleDaysThreshold,
  readGeneralSettingsFallback,
  readLayoutSettingsFallback,
  readQuickRescheduleDaysThresholdFallback,
  upsertUserSettings,
  writeGeneralSettingsFallback,
  writeLayoutSettingsFallback,
  writeQuickRescheduleDaysThresholdFallback,
} from '@/lib/user-settings';
import { areNoteTemplatesEqual, defaultNoteTemplates, normalizeNoteTemplates, readNoteTemplates, writeNoteTemplates } from '@/lib/note-templates';
import { dedupeCustomFields, sanitizeListDisplayForFields } from '@/lib/custom-fields';
import { toast } from '@/components/ui/sonner';

// Type definitions for external Supabase tables
interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

interface CustomFieldRow {
  id: string;
  user_id: string;
  key: string;
  name: string;
  field_type: string;
  options: string[] | null;
  enabled: boolean;
  required: boolean;
  default_value: unknown;
  validation: unknown;
  display: string;
  sort_order: number;
}

interface UserSettingsRow {
  id: string;
  user_id: string;
  app_visual_mode?: string | null;
  allow_reopen_completed: boolean;
  default_sort: string;
  activity_creation_mode: string;
  autosave_enabled: boolean;
  note_date_buttons_enabled?: boolean;
  quick_reschedule_days_threshold?: number | null;
  layout_settings?: LayoutSettings;
  list_display?: ActivityListDisplaySettings;
  note_templates?: Json | null;
  saved_filters?: FilterConfig[];
  saved_sort?: SortConfig;
}

type UserSettingsInsert = TablesInsert<'user_settings'>;

function toJson(value: unknown): Json {
  return value as Json;
}

function getNoteTemplatesDatabaseValue(templates: NoteTemplate[]): UserSettingsInsert['note_templates'] {
  if (areNoteTemplatesEqual(templates, defaultNoteTemplates)) {
    return null;
  }

  return toJson(templates) as UserSettingsInsert['note_templates'];
}

const defaultSettings: AppSettings = {
  customFields: [],
  tags: [],
  noteTemplates: defaultNoteTemplates,
  appVisualMode: 'current',
  allowReopenCompleted: true,
  defaultSort: 'manual',
  activityCreationMode: 'detailed',
  autosaveEnabled: true,
  noteDateButtonsEnabled: true,
  quickRescheduleDaysThreshold: 0,
  layout: defaultLayoutSettings,
  listDisplay: defaultListDisplay,
  savedFilters: [],
  savedSort: defaultSortConfig,
};

export function useSettings() {
  const { user, isAuthenticated } = useAuthContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>(defaultNoteTemplates);
  const [generalSettings, setGeneralSettings] = useState<{
    allowReopenCompleted: boolean;
    appVisualMode: AppVisualMode;
    defaultSort: SortOption;
    activityCreationMode: ActivityCreationMode;
    autosaveEnabled: boolean;
    noteDateButtonsEnabled: boolean;
    quickRescheduleDaysThreshold: number;
    layout: LayoutSettings;
    listDisplay: ActivityListDisplaySettings;
    savedFilters: FilterConfig[];
    savedSort: SortConfig;
  }>({
    allowReopenCompleted: true,
    appVisualMode: 'current',
    defaultSort: 'manual',
    activityCreationMode: 'detailed',
    autosaveEnabled: true,
    noteDateButtonsEnabled: true,
    quickRescheduleDaysThreshold: 0,
    layout: defaultLayoutSettings,
    listDisplay: defaultListDisplay,
    savedFilters: [],
    savedSort: defaultSortConfig,
  });
  const [isLoading, setIsLoading] = useState(true);

  const persistGeneralSettingsFallback = useCallback((nextSettings: {
    defaultSort: SortOption;
    appVisualMode: AppVisualMode;
    allowReopenCompleted: boolean;
    activityCreationMode: ActivityCreationMode;
    autosaveEnabled: boolean;
    noteDateButtonsEnabled: boolean;
    quickRescheduleDaysThreshold: number;
    layout: LayoutSettings;
    listDisplay: ActivityListDisplaySettings;
    savedFilters: FilterConfig[];
    savedSort: SortConfig;
  }) => {
    if (!user) {
      return;
    }

    writeGeneralSettingsFallback(user.id, {
      defaultSort: nextSettings.defaultSort,
      appVisualMode: nextSettings.appVisualMode,
      allowReopenCompleted: nextSettings.allowReopenCompleted,
      activityCreationMode: nextSettings.activityCreationMode,
      autosaveEnabled: nextSettings.autosaveEnabled,
      noteDateButtonsEnabled: nextSettings.noteDateButtonsEnabled,
      quickRescheduleDaysThreshold: nextSettings.quickRescheduleDaysThreshold,
      layout: nextSettings.layout,
      listDisplay: nextSettings.listDisplay,
      savedFilters: nextSettings.savedFilters,
      savedSort: nextSettings.savedSort,
    });
  }, [user]);

  // Load all settings from database
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setTags([]);
      setCustomFields([]);
      setNoteTemplates(defaultNoteTemplates);
      setGeneralSettings({
        allowReopenCompleted: true,
        appVisualMode: 'current',
        defaultSort: 'manual',
        activityCreationMode: 'detailed',
        autosaveEnabled: true,
        noteDateButtonsEnabled: true,
        quickRescheduleDaysThreshold: 0,
        layout: defaultLayoutSettings,
        listDisplay: defaultListDisplay,
        savedFilters: [],
        savedSort: defaultSortConfig,
      });
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const generalSettingsFallback = readGeneralSettingsFallback(user.id);
        const layoutSettingsFallback = readLayoutSettingsFallback(user.id);
        const quickRescheduleDaysThresholdFallback = readQuickRescheduleDaysThresholdFallback(user.id);
        const localNoteTemplates = readNoteTemplates(user.id);

        // Load tags
        const { data: tagsData, error: tagsError } = await supabase
          .from('tags' as never)
          .select('*')
          .eq('user_id', user.id)
          .order('name') as { data: TagRow[] | null; error: unknown };

        if (!tagsError && tagsData) {
          setTags(tagsData.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
          })));
        }

        // Load custom fields
        const { data: fieldsData, error: fieldsError } = await supabase
          .from('custom_fields' as never)
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order') as { data: CustomFieldRow[] | null; error: unknown };

        if (!fieldsError && fieldsData) {
          setCustomFields(dedupeCustomFields(fieldsData.map(f => ({
            id: f.id,
            key: f.key,
            name: f.name,
            type: f.field_type as CustomField['type'],
            options: f.options || undefined,
            enabled: f.enabled,
            required: f.required,
            defaultValue: f.default_value as CustomField['defaultValue'],
            validation: f.validation as CustomField['validation'],
            display: f.display as CustomField['display'],
            order: f.sort_order,
          }))));
        }

        // Load general settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('user_settings' as never)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle() as { data: UserSettingsRow | null; error: unknown };

        if (!settingsError && settingsData) {
          const quickRescheduleDaysThreshold =
            settingsData.quick_reschedule_days_threshold === undefined
              ? (quickRescheduleDaysThresholdFallback ?? generalSettingsFallback?.quickRescheduleDaysThreshold ?? 0)
              : normalizeQuickRescheduleDaysThreshold(settingsData.quick_reschedule_days_threshold);
          const layoutSettings =
            settingsData.layout_settings === undefined
              ? (layoutSettingsFallback ?? generalSettingsFallback?.layout ?? defaultLayoutSettings)
              : normalizeLayoutSettings(settingsData.layout_settings as Partial<LayoutSettings> | null);
          const nextGeneralSettings = {
            allowReopenCompleted: settingsData.allow_reopen_completed ?? generalSettingsFallback?.allowReopenCompleted ?? true,
            appVisualMode: settingsData.app_visual_mode === 'new'
              ? 'new'
              : (generalSettingsFallback?.appVisualMode ?? defaultSettings.appVisualMode),
            defaultSort: (settingsData.default_sort as SortOption) ?? defaultSettings.defaultSort,
            activityCreationMode: (settingsData.activity_creation_mode as ActivityCreationMode) ?? defaultSettings.activityCreationMode,
            autosaveEnabled: settingsData.autosave_enabled ?? generalSettingsFallback?.autosaveEnabled ?? true,
            noteDateButtonsEnabled: settingsData.note_date_buttons_enabled ?? generalSettingsFallback?.noteDateButtonsEnabled ?? true,
            quickRescheduleDaysThreshold,
            layout: layoutSettings,
            listDisplay: settingsData.list_display === undefined
              ? (generalSettingsFallback?.listDisplay ?? defaultListDisplay)
              : normalizeListDisplaySettings(settingsData.list_display as Partial<ActivityListDisplaySettings> | null),
            savedFilters: Array.isArray(settingsData.saved_filters)
              ? settingsData.saved_filters
              : (generalSettingsFallback?.savedFilters ?? []),
            savedSort: settingsData.saved_sort ?? generalSettingsFallback?.savedSort ?? defaultSortConfig,
          };

          writeQuickRescheduleDaysThresholdFallback(user.id, quickRescheduleDaysThreshold);
          writeLayoutSettingsFallback(user.id, layoutSettings);
          persistGeneralSettingsFallback(nextGeneralSettings);
          setGeneralSettings(nextGeneralSettings);

          const remoteNoteTemplates = settingsData.note_templates === undefined || settingsData.note_templates === null
            ? null
            : normalizeNoteTemplates(settingsData.note_templates);
          const nextNoteTemplates = remoteNoteTemplates ?? localNoteTemplates;
          setNoteTemplates(nextNoteTemplates);
          writeNoteTemplates(user.id, nextNoteTemplates);

          if (remoteNoteTemplates === null && !areNoteTemplatesEqual(localNoteTemplates, defaultNoteTemplates)) {
            void upsertUserSettings(user.id, {
              note_templates: getNoteTemplatesDatabaseValue(localNoteTemplates),
            }).then(({ error }) => {
              if (error) {
                console.error('Error migrating local note templates to backend:', error);
              }
            });
          }
        } else {
          const nextGeneralSettings = {
            allowReopenCompleted: generalSettingsFallback?.allowReopenCompleted ?? true,
            appVisualMode: generalSettingsFallback?.appVisualMode ?? defaultSettings.appVisualMode,
            defaultSort: generalSettingsFallback?.defaultSort ?? defaultSettings.defaultSort,
            activityCreationMode: generalSettingsFallback?.activityCreationMode ?? defaultSettings.activityCreationMode,
            autosaveEnabled: generalSettingsFallback?.autosaveEnabled ?? true,
            noteDateButtonsEnabled: generalSettingsFallback?.noteDateButtonsEnabled ?? true,
            quickRescheduleDaysThreshold: quickRescheduleDaysThresholdFallback ?? generalSettingsFallback?.quickRescheduleDaysThreshold ?? 0,
            layout: layoutSettingsFallback ?? generalSettingsFallback?.layout ?? defaultLayoutSettings,
            listDisplay: generalSettingsFallback?.listDisplay ?? defaultListDisplay,
            savedFilters: generalSettingsFallback?.savedFilters ?? [],
            savedSort: generalSettingsFallback?.savedSort ?? defaultSortConfig,
          };
          persistGeneralSettingsFallback(nextGeneralSettings);
          setGeneralSettings(nextGeneralSettings);

          setNoteTemplates(localNoteTemplates);
          writeNoteTemplates(user.id, localNoteTemplates);

          if (!areNoteTemplatesEqual(localNoteTemplates, defaultNoteTemplates)) {
            void upsertUserSettings(user.id, {
              note_templates: getNoteTemplatesDatabaseValue(localNoteTemplates),
            }).then(({ error }) => {
              if (error) {
                console.error('Error migrating local note templates to backend:', error);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isAuthenticated, user, persistGeneralSettingsFallback]);

  // Combine into settings object
  const settings = useMemo<AppSettings>(() => ({
    customFields,
    tags,
    noteTemplates,
    appVisualMode: generalSettings.appVisualMode,
    allowReopenCompleted: generalSettings.allowReopenCompleted,
    defaultSort: generalSettings.defaultSort,
    activityCreationMode: generalSettings.activityCreationMode,
    autosaveEnabled: generalSettings.autosaveEnabled,
    noteDateButtonsEnabled: generalSettings.noteDateButtonsEnabled,
    quickRescheduleDaysThreshold: generalSettings.quickRescheduleDaysThreshold,
    layout: generalSettings.layout,
    listDisplay: sanitizeListDisplayForFields(generalSettings.listDisplay, customFields),
    savedFilters: generalSettings.savedFilters,
    savedSort: generalSettings.savedSort,
  }), [customFields, tags, noteTemplates, generalSettings]);

  // Tag operations
  const addTag = useCallback(async (tag: Omit<Tag, 'id'>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      const { data, error } = await supabase
        .from('tags' as never)
        .insert({
          user_id: user.id,
          name: tag.name,
          color: tag.color,
        } as never)
        .select()
        .single() as { data: TagRow | null; error: unknown };

      if (error || !data) {
        console.error('Error adding tag:', error);
        throw new Error('Nao foi possivel adicionar a tag.');
      }

      const newTag: Tag = {
        id: data.id,
        name: data.name,
        color: data.color,
      };

      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Nao foi possivel adicionar a tag.');
      throw error;
    }
  }, [user]);

  const updateTag = useCallback(async (id: string, updates: Partial<Tag>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      const { error } = await supabase
        .from('tags' as never)
        .update(updates as never)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating tag:', error);
        throw new Error('Nao foi possivel atualizar a tag.');
      }

      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Nao foi possivel atualizar a tag.');
      throw error;
    }
  }, [user]);

  const deleteTag = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      const { error } = await supabase
        .from('tags' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting tag:', error);
        throw new Error('Nao foi possivel excluir a tag.');
      }

      setTags(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Nao foi possivel excluir a tag.');
      throw error;
    }
  }, [user]);

  const getTagById = useCallback((id: string) => {
    return tags.find(tag => tag.id === id);
  }, [tags]);

  // Custom field operations
  const addCustomField = useCallback(async (field: Omit<CustomField, 'id'>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      const { data, error } = await supabase
        .from('custom_fields' as never)
        .insert({
          user_id: user.id,
          key: field.key,
          name: field.name,
          field_type: field.type,
          options: field.options || null,
          enabled: field.enabled,
          required: field.required,
          default_value: field.defaultValue || null,
          validation: field.validation || null,
          display: field.display,
          sort_order: field.order,
        } as never)
        .select()
        .single() as { data: CustomFieldRow | null; error: unknown };

      if (error || !data) {
        console.error('Error adding custom field:', error);
        throw new Error('Nao foi possivel adicionar o campo.');
      }

      const newField: CustomField = {
        id: data.id,
        key: data.key,
        name: data.name,
        type: data.field_type as CustomField['type'],
        options: data.options || undefined,
        enabled: data.enabled,
        required: data.required,
        defaultValue: data.default_value as CustomField['defaultValue'],
        validation: data.validation as CustomField['validation'],
        display: data.display as CustomField['display'],
        order: data.sort_order,
      };

      setCustomFields(prev => [...prev, newField]);
      return newField;
    } catch (error) {
      console.error('Error adding custom field:', error);
      toast.error('Nao foi possivel adicionar o campo.');
      throw error;
    }
  }, [user]);

  const updateCustomField = useCallback(async (id: string, updates: Partial<CustomField>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      // Convert to DB format
      const dbUpdates: Partial<CustomFieldRow> = {};
      if (updates.key !== undefined) dbUpdates.key = updates.key;
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.field_type = updates.type;
      if (updates.options !== undefined) dbUpdates.options = updates.options || null;
      if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
      if (updates.required !== undefined) dbUpdates.required = updates.required;
      if (updates.defaultValue !== undefined) dbUpdates.default_value = updates.defaultValue;
      if (updates.validation !== undefined) dbUpdates.validation = updates.validation;
      if (updates.display !== undefined) dbUpdates.display = updates.display;
      if (updates.order !== undefined) dbUpdates.sort_order = updates.order;

      const { error } = await supabase
        .from('custom_fields' as never)
        .update(dbUpdates as never)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating custom field:', error);
        throw new Error('Nao foi possivel atualizar o campo.');
      }

      setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    } catch (error) {
      console.error('Error updating custom field:', error);
      toast.error('Nao foi possivel atualizar o campo.');
      throw error;
    }
  }, [user]);

  const deleteCustomField = useCallback(async (id: string) => {
    if (!user) {
      throw new Error('Missing user');
    }

    try {
      const { error } = await supabase
        .from('custom_fields' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting custom field:', error);
        throw new Error('Nao foi possivel excluir o campo.');
      }

      setCustomFields(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting custom field:', error);
      toast.error('Nao foi possivel excluir o campo.');
      throw error;
    }
  }, [user]);

  const reorderFields = useCallback(async (startIndex: number, endIndex: number) => {
    if (!user) return;

    // Update local state first (optimistic)
    const newFields = [...customFields];
    const [removed] = newFields.splice(startIndex, 1);
    newFields.splice(endIndex, 0, removed);
    const updatedFields = newFields.map((f, i) => ({ ...f, order: i }));
    setCustomFields(updatedFields);

    // Update in database
    try {
      for (let i = 0; i < updatedFields.length; i++) {
        await supabase
          .from('custom_fields' as never)
          .update({ sort_order: i } as never)
          .eq('id', updatedFields[i].id)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error reordering fields:', error);
    }
  }, [user, customFields]);

  // General settings operations
  const updateGeneralSettings = useCallback(async (updates: Partial<Pick<AppSettings, 'allowReopenCompleted' | 'appVisualMode' | 'defaultSort' | 'activityCreationMode' | 'autosaveEnabled' | 'noteDateButtonsEnabled' | 'quickRescheduleDaysThreshold'>>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const normalizedUpdates = updates.quickRescheduleDaysThreshold === undefined
      ? updates
      : {
          ...updates,
          quickRescheduleDaysThreshold: normalizeQuickRescheduleDaysThreshold(updates.quickRescheduleDaysThreshold),
        };

    if (normalizedUpdates.quickRescheduleDaysThreshold !== undefined) {
      writeQuickRescheduleDaysThresholdFallback(user.id, normalizedUpdates.quickRescheduleDaysThreshold);
    }

    // Update local state (optimistic)
    setGeneralSettings(prev => {
      const nextSettings = { ...prev, ...normalizedUpdates };
      persistGeneralSettingsFallback(nextSettings);
      return nextSettings;
    });

    try {
      // Convert to DB format
      const dbUpdates: Partial<UserSettingsInsert> = {};
      if (normalizedUpdates.allowReopenCompleted !== undefined) dbUpdates.allow_reopen_completed = normalizedUpdates.allowReopenCompleted;
      if (normalizedUpdates.appVisualMode !== undefined) dbUpdates.app_visual_mode = normalizedUpdates.appVisualMode;
      if (normalizedUpdates.defaultSort !== undefined) dbUpdates.default_sort = normalizedUpdates.defaultSort;
      if (normalizedUpdates.activityCreationMode !== undefined) dbUpdates.activity_creation_mode = normalizedUpdates.activityCreationMode;
      if (normalizedUpdates.autosaveEnabled !== undefined) dbUpdates.autosave_enabled = normalizedUpdates.autosaveEnabled;
      if (normalizedUpdates.noteDateButtonsEnabled !== undefined) dbUpdates.note_date_buttons_enabled = normalizedUpdates.noteDateButtonsEnabled;
      if (normalizedUpdates.quickRescheduleDaysThreshold !== undefined) dbUpdates.quick_reschedule_days_threshold = normalizedUpdates.quickRescheduleDaysThreshold;

      const { error } = await upsertUserSettings(user.id, dbUpdates);

      if (error) {
        console.error('Error updating general settings:', error);
        throw new Error('Nao foi possivel salvar as configuracoes gerais.');
      }
    } catch (error) {
      console.error('Error updating general settings:', error);
      toast.error('Nao foi possivel salvar as configuracoes gerais.');
      throw error;
    }
  }, [user, persistGeneralSettingsFallback]);

  // List display settings operations
  const updateListDisplay = useCallback(async (updates: Partial<ActivityListDisplaySettings>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    // Update local state (optimistic)
    setGeneralSettings(prev => {
      const nextSettings = {
        ...prev,
        listDisplay: { ...prev.listDisplay, ...updates },
      };
      persistGeneralSettingsFallback(nextSettings);
      return nextSettings;
    });

    try {
      const newListDisplay = sanitizeListDisplayForFields(
        normalizeListDisplaySettings({ ...generalSettings.listDisplay, ...updates }),
        customFields
      );
      const { error } = await upsertUserSettings(user.id, {
        list_display: toJson(newListDisplay) as UserSettingsInsert['list_display'],
      });

      if (error) {
        console.error('Error updating list display settings:', error);
        throw new Error('Nao foi possivel salvar a configuracao da lista.');
      }
    } catch (error) {
      console.error('Error updating list display settings:', error);
      toast.error('Nao foi possivel salvar a configuracao da lista.');
      throw error;
    }
  }, [user, generalSettings.listDisplay, customFields, persistGeneralSettingsFallback]);

  const updateLayoutSettings = useCallback(async (updates: Partial<LayoutSettings>) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const nextLayoutSettings = normalizeLayoutSettings({
      ...generalSettings.layout,
      ...updates,
    });

    writeLayoutSettingsFallback(user.id, nextLayoutSettings);

    setGeneralSettings(prev => ({
      ...prev,
      layout: nextLayoutSettings,
    }));
    persistGeneralSettingsFallback({
      ...generalSettings,
      layout: nextLayoutSettings,
    });

    try {
      const { error } = await upsertUserSettings(user.id, {
        layout_settings: toJson(nextLayoutSettings) as UserSettingsInsert['layout_settings'],
      });

      if (error) {
        console.error('Error updating layout settings:', error);
        throw new Error('Nao foi possivel salvar a configuracao do layout.');
      }
    } catch (error) {
      console.error('Error updating layout settings:', error);
      toast.error('Nao foi possivel salvar a configuracao do layout.');
      throw error;
    }
  }, [user, generalSettings, persistGeneralSettingsFallback]);

  // Saved filters operations
  const updateSavedFilters = useCallback(async (filters: FilterConfig[]) => {
    if (!user) {
      throw new Error('Missing user');
    }

    // Update local state (optimistic)
    setGeneralSettings(prev => {
      const nextSettings = { ...prev, savedFilters: filters };
      persistGeneralSettingsFallback(nextSettings);
      return nextSettings;
    });

    try {
      const { error } = await upsertUserSettings(user.id, {
        saved_filters: toJson(filters) as UserSettingsInsert['saved_filters'],
      });

      if (error) {
        console.error('Error updating saved filters:', error);
        throw new Error('Nao foi possivel salvar os filtros.');
      }
    } catch (error) {
      console.error('Error updating saved filters:', error);
      toast.error('Nao foi possivel salvar os filtros.');
      throw error;
    }
  }, [user, persistGeneralSettingsFallback]);

  // Saved sort operations
  const updateSavedSort = useCallback(async (sort: SortConfig) => {
    if (!user) {
      throw new Error('Missing user');
    }

    // Update local state (optimistic)
    setGeneralSettings(prev => {
      const nextSettings = { ...prev, savedSort: sort };
      persistGeneralSettingsFallback(nextSettings);
      return nextSettings;
    });

    try {
      const { error } = await upsertUserSettings(user.id, {
        saved_sort: toJson(sort) as UserSettingsInsert['saved_sort'],
      });

      if (error) {
        console.error('Error updating saved sort:', error);
        throw new Error('Nao foi possivel salvar a ordenacao.');
      }
    } catch (error) {
      console.error('Error updating saved sort:', error);
      toast.error('Nao foi possivel salvar a ordenacao.');
      throw error;
    }
  }, [user, persistGeneralSettingsFallback]);

  const updateNoteTemplates = useCallback(async (templates: NoteTemplate[]) => {
    if (!user) {
      throw new Error('Missing user');
    }

    const nextTemplates = templates.length > 0 ? templates : defaultNoteTemplates;
    setNoteTemplates(nextTemplates);
    writeNoteTemplates(user.id, nextTemplates);

    try {
      const { error } = await upsertUserSettings(user.id, {
        note_templates: getNoteTemplatesDatabaseValue(nextTemplates),
      });

      if (error) {
        console.error('Error updating note templates:', error);
        throw new Error('Nao foi possivel salvar os templates.');
      }
    } catch (error) {
      console.error('Error updating note templates:', error);
      toast.error('Nao foi possivel salvar os templates.');
      throw error;
    }
  }, [user]);

  return {
    settings,
    isLoading,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    reorderFields,
    addTag,
    updateTag,
    deleteTag,
    getTagById,
    updateGeneralSettings,
    updateLayoutSettings,
    updateListDisplay,
    updateSavedFilters,
    updateSavedSort,
    updateNoteTemplates,
  };
}
