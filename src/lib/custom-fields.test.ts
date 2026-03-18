import { describe, expect, it } from 'vitest';
import type { ActivityListDisplaySettings, CustomField } from '@/types';
import { dedupeCustomFields, isProtectedCustomField, sanitizeListDisplayForFields } from './custom-fields';

function buildField(overrides: Partial<CustomField>): CustomField {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    key: overrides.key ?? 'custom',
    name: overrides.name ?? 'Campo',
    type: overrides.type ?? 'text',
    enabled: overrides.enabled ?? true,
    required: overrides.required ?? false,
    display: overrides.display ?? 'both',
    order: overrides.order ?? 0,
    options: overrides.options,
    defaultValue: overrides.defaultValue,
    validation: overrides.validation,
  };
}

const baseListDisplay: ActivityListDisplaySettings = {
  showTags: true,
  showDueDate: true,
  showPriority: true,
  visibleFieldIds: [],
  formLayout: { blocks: [] },
};

describe('custom field helpers', () => {
  it('identifies protected default fields', () => {
    expect(isProtectedCustomField(buildField({ key: 'dueDate' }))).toBe(true);
    expect(isProtectedCustomField(buildField({ key: 'priority' }))).toBe(true);
    expect(isProtectedCustomField(buildField({ key: 'description' }))).toBe(false);
    expect(isProtectedCustomField(buildField({ key: 'cliente' }))).toBe(false);
  });

  it('dedupes duplicated protected fields while keeping custom ones', () => {
    const fields = dedupeCustomFields([
      buildField({ id: 'a', key: 'dueDate', order: 0 }),
      buildField({ id: 'b', key: 'dueDate', order: 1 }),
      buildField({ id: 'c', key: 'priority', order: 2 }),
      buildField({ id: 'd', key: 'priority', order: 3 }),
      buildField({ id: 'e', key: 'cliente', order: 4 }),
    ]);

    expect(fields.map((field) => field.id)).toEqual(['a', 'c', 'e']);
  });

  it('sanitizes list settings based on active fields', () => {
    const fields = [
      buildField({ id: 'due', key: 'dueDate', display: 'both', enabled: false }),
      buildField({ id: 'prio', key: 'priority', display: 'both', enabled: true }),
      buildField({ id: 'desc', key: 'description', display: 'detail', enabled: true }),
      buildField({ id: 'extra', key: 'cliente', display: 'both', enabled: true }),
      buildField({ id: 'hidden', key: 'interno', display: 'detail', enabled: true }),
    ];

    const sanitized = sanitizeListDisplayForFields(
      {
        ...baseListDisplay,
        visibleFieldIds: ['prio', 'extra', 'hidden'],
      },
      fields
    );

    expect(sanitized.showDueDate).toBe(false);
    expect(sanitized.showPriority).toBe(true);
    expect(sanitized.visibleFieldIds).toEqual(['extra']);
  });
});
