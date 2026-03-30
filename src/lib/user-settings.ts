import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesInsert } from '@/integrations/supabase/types';
import type { ActivityCreationMode, ActivityListDisplaySettings, AppSettings, FilterConfig, LayoutSettings, SortConfig, SortOption } from '@/types';
import { defaultActivityFormLayout, normalizeActivityFormLayout } from './activity-form-layout';

const QUICK_RESCHEDULE_THRESHOLD_FALLBACK_KEY = 'user-settings.quick-reschedule-days-threshold';
const LAYOUT_SETTINGS_FALLBACK_KEY = 'user-settings.layout-settings';
const GENERAL_SETTINGS_FALLBACK_KEY = 'user-settings.general';
type UserSettingsInsert = TablesInsert<'user_settings'>;
type CachedGeneralSettings = Pick<
  AppSettings,
  | 'defaultSort'
  | 'allowReopenCompleted'
  | 'activityCreationMode'
  | 'autosaveEnabled'
  | 'noteDateButtonsEnabled'
  | 'quickRescheduleDaysThreshold'
  | 'layout'
  | 'listDisplay'
  | 'savedFilters'
  | 'savedSort'
>;

function toJson(value: unknown): Json {
  return value as Json;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

const validSortOptions = new Set<SortOption>([
  'manual',
  'dueDate_asc',
  'dueDate_desc',
  'priority_asc',
  'priority_desc',
  'createdAt_desc',
  'tag',
  'field',
]);

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

function getQuickRescheduleDaysThresholdFallbackKey(userId: string) {
  return `${QUICK_RESCHEDULE_THRESHOLD_FALLBACK_KEY}:${userId}`;
}

function getLayoutSettingsFallbackKey(userId: string) {
  return `${LAYOUT_SETTINGS_FALLBACK_KEY}:${userId}`;
}

function getGeneralSettingsFallbackKey(userId: string) {
  return `${GENERAL_SETTINGS_FALLBACK_KEY}:${userId}`;
}

export function readQuickRescheduleDaysThresholdFallback(userId?: string | null): number | null {
  if (!userId || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getQuickRescheduleDaysThresholdFallbackKey(userId));
    if (storedValue === null) {
      return null;
    }

    return normalizeQuickRescheduleDaysThreshold(JSON.parse(storedValue));
  } catch (error) {
    console.error('Error reading quick reschedule threshold fallback:', error);
    return null;
  }
}

export function writeQuickRescheduleDaysThresholdFallback(userId: string, value: number) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getQuickRescheduleDaysThresholdFallbackKey(userId),
      JSON.stringify(normalizeQuickRescheduleDaysThreshold(value))
    );
  } catch (error) {
    console.error('Error writing quick reschedule threshold fallback:', error);
  }
}

export function readLayoutSettingsFallback(userId?: string | null): LayoutSettings | null {
  if (!userId || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getLayoutSettingsFallbackKey(userId));
    if (storedValue === null) {
      return null;
    }

    return normalizeLayoutSettings(JSON.parse(storedValue) as Partial<LayoutSettings>);
  } catch (error) {
    console.error('Error reading layout settings fallback:', error);
    return null;
  }
}

export function writeLayoutSettingsFallback(userId: string, layoutSettings: LayoutSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getLayoutSettingsFallbackKey(userId),
      JSON.stringify(normalizeLayoutSettings(layoutSettings))
    );
  } catch (error) {
    console.error('Error writing layout settings fallback:', error);
  }
}

export function readGeneralSettingsFallback(userId?: string | null): Partial<CachedGeneralSettings> | null {
  if (!userId || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(getGeneralSettingsFallbackKey(userId));
    if (storedValue === null) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Record<string, unknown>;
    if (!isObject(parsedValue)) {
      return null;
    }

    const fallback: Partial<CachedGeneralSettings> = {};

    if (typeof parsedValue.defaultSort === 'string' && validSortOptions.has(parsedValue.defaultSort as SortOption)) {
      fallback.defaultSort = parsedValue.defaultSort as SortOption;
    }
    if (typeof parsedValue.allowReopenCompleted === 'boolean') {
      fallback.allowReopenCompleted = parsedValue.allowReopenCompleted;
    }
    if (parsedValue.activityCreationMode === 'simple' || parsedValue.activityCreationMode === 'detailed') {
      fallback.activityCreationMode = parsedValue.activityCreationMode as ActivityCreationMode;
    }
    if (typeof parsedValue.autosaveEnabled === 'boolean') {
      fallback.autosaveEnabled = parsedValue.autosaveEnabled;
    }
    if (typeof parsedValue.noteDateButtonsEnabled === 'boolean') {
      fallback.noteDateButtonsEnabled = parsedValue.noteDateButtonsEnabled;
    }
    if ('quickRescheduleDaysThreshold' in parsedValue) {
      fallback.quickRescheduleDaysThreshold = normalizeQuickRescheduleDaysThreshold(parsedValue.quickRescheduleDaysThreshold);
    }
    if ('layout' in parsedValue) {
      fallback.layout = normalizeLayoutSettings(parsedValue.layout as Partial<LayoutSettings> | null);
    }
    if ('listDisplay' in parsedValue) {
      fallback.listDisplay = normalizeListDisplaySettings(parsedValue.listDisplay as Partial<ActivityListDisplaySettings> | null);
    }
    if (Array.isArray(parsedValue.savedFilters)) {
      fallback.savedFilters = parsedValue.savedFilters as FilterConfig[];
    }
    if (
      isObject(parsedValue.savedSort) &&
      typeof parsedValue.savedSort.type === 'string' &&
      typeof parsedValue.savedSort.direction === 'string'
    ) {
      fallback.savedSort = parsedValue.savedSort as unknown as SortConfig;
    }

    return fallback;
  } catch (error) {
    console.error('Error reading general settings fallback:', error);
    return null;
  }
}

export function writeGeneralSettingsFallback(userId: string, settings: CachedGeneralSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      getGeneralSettingsFallbackKey(userId),
      JSON.stringify({
        ...settings,
        defaultSort: validSortOptions.has(settings.defaultSort) ? settings.defaultSort : 'manual',
        quickRescheduleDaysThreshold: normalizeQuickRescheduleDaysThreshold(settings.quickRescheduleDaysThreshold),
        layout: normalizeLayoutSettings(settings.layout),
        listDisplay: normalizeListDisplaySettings(settings.listDisplay),
      })
    );
  } catch (error) {
    console.error('Error writing general settings fallback:', error);
  }
}

export function extractMissingUserSettingsColumn(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  const match = message.match(/column\s+user_settings\.([a-z0-9_]+)\s+does not exist/i);
  return match?.[1] ?? null;
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
    layout_settings: toJson(defaultLayoutSettings) as UserSettingsInsert['layout_settings'],
    list_display: toJson(defaultListDisplay) as UserSettingsInsert['list_display'],
    saved_filters: [],
    saved_sort: toJson(defaultSortConfig) as UserSettingsInsert['saved_sort'],
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
  let nextUpdates = { ...updates };

  while (true) {
    const upsertResult = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          ...nextUpdates,
        },
        { onConflict: 'user_id' }
      );

    if (!upsertResult.error) {
      return upsertResult;
    }

    const missingColumn = extractMissingUserSettingsColumn(upsertResult.error);
    if (!missingColumn || !(missingColumn in nextUpdates)) {
      return upsertResult;
    }

    const { [missingColumn]: _omitted, ...remainingUpdates } = nextUpdates as Record<string, unknown>;
    nextUpdates = remainingUpdates as Partial<TablesInsert<'user_settings'>>;
  }
}
