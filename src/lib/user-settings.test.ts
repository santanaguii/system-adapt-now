import { describe, expect, it } from 'vitest';
import { buildDefaultUserSettings, normalizeQuickRescheduleDaysThreshold } from './user-settings';

describe('buildDefaultUserSettings', () => {
  it('creates a complete settings row for new users', () => {
    const settings = buildDefaultUserSettings('user-1');

    expect(settings.user_id).toBe('user-1');
    expect(settings.allow_reopen_completed).toBe(true);
    expect(settings.autosave_enabled).toBe(true);
    expect(settings.note_date_buttons_enabled).toBe(true);
    expect(settings.quick_reschedule_days_threshold).toBe(0);
    expect(settings.activity_creation_mode).toBe('detailed');
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
