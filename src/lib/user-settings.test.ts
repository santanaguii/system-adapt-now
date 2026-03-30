import { describe, expect, it } from 'vitest';
import {
  buildDefaultUserSettings,
  defaultLayoutSettings,
  extractMissingUserSettingsColumn,
  normalizeLayoutSettings,
  normalizeQuickRescheduleDaysThreshold,
  readGeneralSettingsFallback,
  readLayoutSettingsFallback,
  readQuickRescheduleDaysThresholdFallback,
  writeGeneralSettingsFallback,
  writeLayoutSettingsFallback,
  writeQuickRescheduleDaysThresholdFallback,
} from './user-settings';

describe('buildDefaultUserSettings', () => {
  it('creates a complete settings row for new users', () => {
    const settings = buildDefaultUserSettings('user-1');

    expect(settings.user_id).toBe('user-1');
    expect(settings.allow_reopen_completed).toBe(true);
    expect(settings.autosave_enabled).toBe(true);
    expect(settings.note_date_buttons_enabled).toBe(true);
    expect(settings.quick_reschedule_days_threshold).toBe(0);
    expect(settings.activity_creation_mode).toBe('detailed');
    expect(settings.layout_settings).toEqual(defaultLayoutSettings);
    expect(settings.mobile_layout_mode).toBe('mobile');
    expect(settings.note_line_spacing).toBe('35');
    expect(settings.saved_filters).toEqual([]);
    expect(settings.saved_sort).toEqual({ type: 'manual', direction: 'asc' });
  });
});

describe('normalizeQuickRescheduleDaysThreshold', () => {
  it('normalizes invalid values to zero', () => {
    expect(normalizeQuickRescheduleDaysThreshold(undefined)).toBe(0);
    expect(normalizeQuickRescheduleDaysThreshold(-4)).toBe(0);
    expect(normalizeQuickRescheduleDaysThreshold('abc')).toBe(0);
  });

  it('keeps non-negative integer values', () => {
    expect(normalizeQuickRescheduleDaysThreshold(3)).toBe(3);
    expect(normalizeQuickRescheduleDaysThreshold(3.9)).toBe(3);
    expect(normalizeQuickRescheduleDaysThreshold('7')).toBe(7);
  });
});

describe('quick reschedule threshold fallback', () => {
  it('persists the fallback value in localStorage', () => {
    window.localStorage.clear();

    writeQuickRescheduleDaysThresholdFallback('user-1', 5.9);

    expect(readQuickRescheduleDaysThresholdFallback('user-1')).toBe(5);
    expect(readQuickRescheduleDaysThresholdFallback('user-2')).toBeNull();
  });
});

describe('layout settings fallback', () => {
  it('persists layout settings in localStorage', () => {
    window.localStorage.clear();

    writeLayoutSettingsFallback('user-1', {
      ...defaultLayoutSettings,
      showActivities: false,
    });

    expect(readLayoutSettingsFallback('user-1')).toEqual({
      ...defaultLayoutSettings,
      showActivities: false,
    });
    expect(readLayoutSettingsFallback('user-2')).toBeNull();
  });
});

describe('general settings fallback', () => {
  it('persists general settings in localStorage', () => {
    window.localStorage.clear();

    writeGeneralSettingsFallback('user-1', {
      defaultSort: 'createdAt_desc',
      allowReopenCompleted: false,
      activityCreationMode: 'simple',
      autosaveEnabled: false,
      noteDateButtonsEnabled: false,
      quickRescheduleDaysThreshold: 6,
      layout: {
        ...defaultLayoutSettings,
        showActivities: false,
      },
      listDisplay: {
        showTags: true,
        showDueDate: false,
        showPriority: true,
        visibleFieldIds: ['field-1'],
        formLayout: {
          blocks: [
            { id: 'title', contentKey: 'title', colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 1 },
          ],
        },
      },
      savedFilters: [],
      savedSort: { type: 'manual', direction: 'desc' },
    });

    expect(readGeneralSettingsFallback('user-1')).toEqual({
      defaultSort: 'createdAt_desc',
      allowReopenCompleted: false,
      activityCreationMode: 'simple',
      autosaveEnabled: false,
      noteDateButtonsEnabled: false,
      quickRescheduleDaysThreshold: 6,
      layout: {
        ...defaultLayoutSettings,
        showActivities: false,
      },
      listDisplay: {
        showTags: true,
        showDueDate: false,
        showPriority: true,
        visibleFieldIds: ['field-1'],
        formLayout: {
          blocks: [
            { id: 'title', contentKey: 'title', colStart: 1, rowStart: 1, colSpan: 12, rowSpan: 1 },
          ],
        },
      },
      savedFilters: [],
      savedSort: { type: 'manual', direction: 'desc' },
    });
    expect(readGeneralSettingsFallback('user-2')).toBeNull();
  });
});

describe('extractMissingUserSettingsColumn', () => {
  it('extracts the missing column name from PostgREST errors', () => {
    expect(
      extractMissingUserSettingsColumn({
        message: 'column user_settings.quick_reschedule_days_threshold does not exist',
      })
    ).toBe('quick_reschedule_days_threshold');
  });
});

describe('normalizeLayoutSettings', () => {
  it('falls back to defaults and keeps at least one main panel visible', () => {
    expect(normalizeLayoutSettings(undefined)).toEqual(defaultLayoutSettings);
    expect(normalizeLayoutSettings({ showNotes: false, showActivities: false })).toEqual({
      ...defaultLayoutSettings,
      showNotes: true,
      showActivities: true,
    });
  });

  it('clamps persisted panel sizes to valid ranges', () => {
    expect(normalizeLayoutSettings({
      desktopMainPanelSize: 10,
      desktopNotesListPanelSize: 80,
      tabletNotesPanelSize: 10,
    })).toEqual({
      ...defaultLayoutSettings,
      desktopMainPanelSize: 40,
      desktopNotesListPanelSize: 45,
      tabletNotesPanelSize: 35,
    });
  });
});
