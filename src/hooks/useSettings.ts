import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSettings, CustomField, Tag, SortOption, ActivityCreationMode } from '@/types';
import { useAuthContext } from '@/contexts/AuthContext';

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
  allow_reopen_completed: boolean;
  default_sort: string;
  activity_creation_mode: string;
}

const defaultSettings: AppSettings = {
  customFields: [],
  tags: [],
  allowReopenCompleted: true,
  defaultSort: 'manual',
  activityCreationMode: 'simple',
};

export function useSettings() {
  const { user, isAuthenticated } = useAuthContext();
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [generalSettings, setGeneralSettings] = useState<{
    allowReopenCompleted: boolean;
    defaultSort: SortOption;
    activityCreationMode: ActivityCreationMode;
  }>({
    allowReopenCompleted: true,
    defaultSort: 'manual',
    activityCreationMode: 'simple',
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load all settings from database
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setTags([]);
      setCustomFields([]);
      setGeneralSettings({
        allowReopenCompleted: true,
        defaultSort: 'manual',
        activityCreationMode: 'simple',
      });
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      try {
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
          setCustomFields(fieldsData.map(f => ({
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
          })));
        }

        // Load general settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('user_settings' as never)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle() as { data: UserSettingsRow | null; error: unknown };

        if (!settingsError && settingsData) {
          setGeneralSettings({
            allowReopenCompleted: settingsData.allow_reopen_completed,
            defaultSort: settingsData.default_sort as SortOption,
            activityCreationMode: settingsData.activity_creation_mode as ActivityCreationMode,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isAuthenticated, user]);

  // Combine into settings object
  const settings = useMemo<AppSettings>(() => ({
    customFields,
    tags,
    allowReopenCompleted: generalSettings.allowReopenCompleted,
    defaultSort: generalSettings.defaultSort,
    activityCreationMode: generalSettings.activityCreationMode,
  }), [customFields, tags, generalSettings]);

  // Tag operations
  const addTag = useCallback(async (tag: Omit<Tag, 'id'>) => {
    if (!user) return null;

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
        return null;
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
      return null;
    }
  }, [user]);

  const updateTag = useCallback(async (id: string, updates: Partial<Tag>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tags' as never)
        .update(updates as never)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating tag:', error);
        return;
      }

      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  }, [user]);

  const deleteTag = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tags' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting tag:', error);
        return;
      }

      setTags(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  }, [user]);

  const getTagById = useCallback((id: string) => {
    return tags.find(tag => tag.id === id);
  }, [tags]);

  // Custom field operations
  const addCustomField = useCallback(async (field: Omit<CustomField, 'id' | 'order'>) => {
    if (!user) return null;

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
          sort_order: customFields.length,
        } as never)
        .select()
        .single() as { data: CustomFieldRow | null; error: unknown };

      if (error || !data) {
        console.error('Error adding custom field:', error);
        return null;
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
      return null;
    }
  }, [user, customFields.length]);

  const updateCustomField = useCallback(async (id: string, updates: Partial<CustomField>) => {
    if (!user) return;

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
        return;
      }

      setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    } catch (error) {
      console.error('Error updating custom field:', error);
    }
  }, [user]);

  const deleteCustomField = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('custom_fields' as never)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting custom field:', error);
        return;
      }

      setCustomFields(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error('Error deleting custom field:', error);
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
  const updateGeneralSettings = useCallback(async (updates: Partial<Pick<AppSettings, 'allowReopenCompleted' | 'defaultSort' | 'activityCreationMode'>>) => {
    if (!user) return;

    // Update local state (optimistic)
    setGeneralSettings(prev => ({ ...prev, ...updates }));

    try {
      // Convert to DB format
      const dbUpdates: Partial<UserSettingsRow> = {};
      if (updates.allowReopenCompleted !== undefined) dbUpdates.allow_reopen_completed = updates.allowReopenCompleted;
      if (updates.defaultSort !== undefined) dbUpdates.default_sort = updates.defaultSort;
      if (updates.activityCreationMode !== undefined) dbUpdates.activity_creation_mode = updates.activityCreationMode;

      const { error } = await supabase
        .from('user_settings' as never)
        .update(dbUpdates as never)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating general settings:', error);
      }
    } catch (error) {
      console.error('Error updating general settings:', error);
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
  };
}
