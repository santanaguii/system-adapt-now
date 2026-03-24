import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import type { ActivityListDisplaySettings, LayoutSettings, SortConfig } from '@/types';
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

export const defaultLayoutSettings: LayoutSettings = {
  showTabs: true,
  showNotes: true,
  showNotesList: true,
  showActivities: true,
  desktopMainPanelSize: 65,
  desktopNotesListPanelSize: 30,
  tabletNotesPanelSize: 55,
};

function normalizePanelSize(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof numericValue === 'number' && Number.isFinite(numericValue)) {
    return Math.min(max, Math.max(min, Math.round(numericValue * 100) / 100));
  }

  return fallback;
}

export function normalizeQuickRescheduleDaysThreshold(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10);
    if (Number.isFinite(parsedValue)) {
      return Math.max(0, parsedValue);
    }
  }

  return 0;
}

export function normalizeListDisplaySettings(listDisplay: Partial<ActivityListDisplaySettings> | null | undefined): ActivityListDisplaySettings {
  return {
    showTags: listDisplay?.showTags ?? defaultListDisplay.showTags,
    showDueDate: listDisplay?.showDueDate ?? defaultListDisplay.showDueDate,
    showPriority: listDisplay?.showPriority ?? defaultListDisplay.showPriority,
    visibleFieldIds: Array.isArray(listDisplay?.visibleFieldIds) ? listDisplay!.visibleFieldIds : defaultListDisplay.visibleFieldIds,
    formLayout: normalizeActivityFormLayout(listDisplay?.formLayout),
  };
}

export function normalizeLayoutSettings(layoutSettings: Partial<LayoutSettings> | null | undefined): LayoutSettings {
  const showTabs = typeof layoutSettings?.showTabs === 'boolean'
    ? layoutSettings.showTabs
    : defaultLayoutSettings.showTabs;
  const showNotes = typeof layoutSettings?.showNotes === 'boolean'
    ? layoutSettings.showNotes
    : defaultLayoutSettings.showNotes;
  const showNotesList = typeof layoutSettings?.showNotesList === 'boolean'
    ? layoutSettings.showNotesList
    : defaultLayoutSettings.showNotesList;
  const showActivities = typeof layoutSettings?.showActivities === 'boolean'
    ? layoutSettings.showActivities
    : defaultLayoutSettings.showActivities;

  return {
    showTabs,
    showNotes: showNotes || !showActivities,
    showNotesList,
    showActivities: showActivities || !showNotes,
    desktopMainPanelSize: normalizePanelSize(
      layoutSettings?.desktopMainPanelSize,
      defaultLayoutSettings.desktopMainPanelSize,
      40,
      80
    ),
    desktopNotesListPanelSize: normalizePanelSize(
      layoutSettings?.desktopNotesListPanelSize,
      defaultLayoutSettings.desktopNotesListPanelSize,
      20,
      45
    ),
    tabletNotesPanelSize: normalizePanelSize(
      layoutSettings?.tabletNotesPanelSize,
      defaultLayoutSettings.tabletNotesPanelSize,
      35,
      70
    ),
  };
}

export function buildDefaultUserSettings(userId: string): TablesInsert<'user_settings'> {
  return {
    user_id: userId,
    allow_reopen_completed: true,
    default_sort: 'manual',
    activity_creation_mode: 'detailed',
    autosave_enabled: true,
    note_date_buttons_enabled: true,
    quick_reschedule_days_threshold: 0,
    layout_settings: defaultLayoutSettings,
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
