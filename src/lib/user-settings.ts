import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import type { ActivityListDisplaySettings, SortConfig } from '@/types';
import { defaultActivityFormLayout, normalizeActivityFormLayout } from './activity-form-layout';

export const defaultListDisplay: ActivityListDisplaySettings = {
  showTags: true,
  showDueDate: true,
  showPriority: true,
  visibleFieldIds: [],
  formLayout: defaultActivityFormLayout,
};

export const defaultSortConfig: SortConfig = {
  type: 'manual',
  direction: 'asc',
};

export function normalizeListDisplaySettings(listDisplay: Partial<ActivityListDisplaySettings> | null | undefined): ActivityListDisplaySettings {
  return {
    showTags: listDisplay?.showTags ?? defaultListDisplay.showTags,
    showDueDate: listDisplay?.showDueDate ?? defaultListDisplay.showDueDate,
    showPriority: listDisplay?.showPriority ?? defaultListDisplay.showPriority,
    visibleFieldIds: Array.isArray(listDisplay?.visibleFieldIds) ? listDisplay!.visibleFieldIds : defaultListDisplay.visibleFieldIds,
    formLayout: normalizeActivityFormLayout(listDisplay?.formLayout),
  };
}

export function buildDefaultUserSettings(userId: string): TablesInsert<'user_settings'> {
  return {
    user_id: userId,
    allow_reopen_completed: true,
    default_sort: 'manual',
    activity_creation_mode: 'detailed',
    autosave_enabled: true,
    list_display: defaultListDisplay,
    saved_filters: [],
    saved_sort: defaultSortConfig,
    font_family: 'inter',
    font_size: 'medium',
    color_theme: 'amber',
    theme_mode: 'system',
    mobile_layout_mode: 'mobile',
    note_line_spacing: '35',
  };
}

export async function upsertUserSettings(
  userId: string,
  updates: Partial<TablesInsert<'user_settings'>>
) {
  return supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      { onConflict: 'user_id' }
    );
}
