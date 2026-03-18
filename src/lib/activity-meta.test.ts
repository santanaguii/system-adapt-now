import { describe, expect, it } from 'vitest';
import type { Activity } from '@/types';
import { ACTIVITY_META, shouldShowInToday } from './activity-meta';

function buildActivity(customFields: Activity['customFields']): Activity {
  return {
    id: 'activity-1',
    title: 'Teste',
    status: 'open',
    completed: false,
    tags: [],
    customFields,
    order: 0,
    createdAt: new Date('2026-03-17T12:00:00.000Z'),
    updatedAt: new Date('2026-03-17T12:00:00.000Z'),
  };
}

describe('shouldShowInToday', () => {
  it('treats ISO due dates from date fields as due today', () => {
    const activity = buildActivity({ dueDate: '2026-03-17T03:00:00.000Z' });

    expect(shouldShowInToday(activity, '2026-03-17')).toBe(true);
  });

  it('treats ISO scheduled dates as due today', () => {
    const activity = buildActivity({ [ACTIVITY_META.scheduledDate]: '2026-03-17T03:00:00.000Z' });

    expect(shouldShowInToday(activity, '2026-03-17')).toBe(true);
  });
});
