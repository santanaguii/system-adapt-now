import type { ActivityListDisplaySettings, CustomField } from '@/types';

export const PROTECTED_CUSTOM_FIELD_KEYS = ['dueDate', 'priority'] as const;

export function isProtectedCustomField(field: Pick<CustomField, 'key'>) {
  return PROTECTED_CUSTOM_FIELD_KEYS.includes(field.key as (typeof PROTECTED_CUSTOM_FIELD_KEYS)[number]);
}

export function isListEligibleCustomField(field: CustomField) {
  return field.enabled && (field.display === 'list' || field.display === 'both');
}

export function dedupeCustomFields(fields: CustomField[]) {
  const seenProtectedKeys = new Set<string>();

  return [...fields]
    .sort((a, b) => a.order - b.order)
    .filter((field) => {
      if (!isProtectedCustomField(field)) {
        return true;
      }

      if (seenProtectedKeys.has(field.key)) {
        return false;
      }

      seenProtectedKeys.add(field.key);
      return true;
    });
}

export function sanitizeListDisplayForFields(
  listDisplay: ActivityListDisplaySettings,
  customFields: CustomField[]
): ActivityListDisplaySettings {
  const eligibleFields = dedupeCustomFields(customFields);
  const visibleFieldIds = Array.from(
    new Set(
      (listDisplay.visibleFieldIds || []).filter((fieldId) =>
        eligibleFields.some(
          (field) => field.id === fieldId && isListEligibleCustomField(field) && !isProtectedCustomField(field)
        )
      )
    )
  );

  const dueDateEnabled = eligibleFields.some((field) => field.key === 'dueDate' && isListEligibleCustomField(field));
  const priorityEnabled = eligibleFields.some((field) => field.key === 'priority' && isListEligibleCustomField(field));

  return {
    ...listDisplay,
    showDueDate: dueDateEnabled ? listDisplay.showDueDate : false,
    showPriority: priorityEnabled ? listDisplay.showPriority : false,
    visibleFieldIds,
  };
}
