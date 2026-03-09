import type {
  Activity,
  ActivityBucket,
  ActivityRecurrence,
  ActivitySubtask,
  JsonObject,
  JsonValue,
} from '@/types';
import { formatDateKey, parseDateKey } from '@/lib/date';

export const ACTIVITY_META = {
  bucket: 'system_bucket',
  scheduledDate: 'system_scheduledDate',
  project: 'system_project',
  area: 'system_area',
  nextAction: 'system_nextAction',
  blockedBy: 'system_blockedBy',
  predecessors: 'system_predecessors',
  successors: 'system_successors',
  subtasks: 'system_subtasks',
  recurrence: 'system_recurrence',
  linkedNoteDates: 'system_linkedNoteDates',
  sourceLineIds: 'system_sourceLineIds',
  favorite: 'system_favorite',
  reviewAt: 'system_reviewAt',
} as const;

const ACTIVITY_REF_PREFIX = 'activity:';
const TEXT_REF_PREFIX = 'text:';

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: JsonValue | undefined): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getMetaString(activity: Activity, key: string) {
  const value = activity.customFields[key];
  return typeof value === 'string' ? value : '';
}

export function getMetaBoolean(activity: Activity, key: string) {
  return activity.customFields[key] === true;
}

export function getActivityBucket(activity: Activity): ActivityBucket {
  const bucket = getMetaString(activity, ACTIVITY_META.bucket);
  return bucket === 'today' || bucket === 'upcoming' || bucket === 'someday' ? bucket : 'inbox';
}

export function getScheduledDate(activity: Activity) {
  return getMetaString(activity, ACTIVITY_META.scheduledDate) || null;
}

export function getProjectName(activity: Activity) {
  return getMetaString(activity, ACTIVITY_META.project);
}

export function getAreaName(activity: Activity) {
  return getMetaString(activity, ACTIVITY_META.area);
}

export function getNextAction(activity: Activity) {
  return getMetaString(activity, ACTIVITY_META.nextAction);
}

export function getBlockedBy(activity: Activity) {
  return getMetaString(activity, ACTIVITY_META.blockedBy);
}

export function getLinkedNoteDates(activity: Activity) {
  const value = activity.customFields[ACTIVITY_META.linkedNoteDates];
  return isStringArray(value) ? value : [];
}

export function getSourceLineIds(activity: Activity) {
  const value = activity.customFields[ACTIVITY_META.sourceLineIds];
  return isStringArray(value) ? value : [];
}

function getDependencyRefs(customFields: Activity['customFields'], key: string) {
  const value = customFields[key];
  return isStringArray(value) ? uniqueStrings(value) : [];
}

export function getPredecessorRefs(activity: Activity) {
  return getDependencyRefs(activity.customFields, ACTIVITY_META.predecessors);
}

export function getSuccessorRefs(activity: Activity) {
  return getDependencyRefs(activity.customFields, ACTIVITY_META.successors);
}

export function createActivityRef(activityId: string) {
  return `${ACTIVITY_REF_PREFIX}${activityId}`;
}

export function createTextRef(value: string) {
  return `${TEXT_REF_PREFIX}${value.trim()}`;
}

export function parseDependencyRef(value: string) {
  if (value.startsWith(ACTIVITY_REF_PREFIX)) {
    return {
      type: 'activity' as const,
      id: value.slice(ACTIVITY_REF_PREFIX.length),
      label: value.slice(ACTIVITY_REF_PREFIX.length),
      raw: value,
    };
  }

  if (value.startsWith(TEXT_REF_PREFIX)) {
    return {
      type: 'text' as const,
      label: value.slice(TEXT_REF_PREFIX.length),
      raw: value,
    };
  }

  return {
    type: 'text' as const,
    label: value,
    raw: value,
  };
}

function getActivityIdsFromRefs(refs: string[]) {
  return refs.flatMap((ref) => {
    const parsed = parseDependencyRef(ref);
    return parsed.type === 'activity' && parsed.id ? [parsed.id] : [];
  });
}

function addActivityRef(refs: string[], activityId: string) {
  return uniqueStrings([...refs.filter((ref) => parseDependencyRef(ref).type !== 'activity' || parseDependencyRef(ref).id !== activityId), createActivityRef(activityId)]);
}

function removeActivityRef(refs: string[], activityId: string) {
  return refs.filter((ref) => {
    const parsed = parseDependencyRef(ref);
    return parsed.type !== 'activity' || parsed.id !== activityId;
  });
}

export function buildDependencySyncUpdates(params: {
  activities: Activity[];
  currentActivityId: string;
  previousCustomFields: Activity['customFields'];
  nextCustomFields: Activity['customFields'];
}) {
  const {
    activities,
    currentActivityId,
    previousCustomFields,
    nextCustomFields,
  } = params;

  const previousPredecessors = new Set(
    getActivityIdsFromRefs(getDependencyRefs(previousCustomFields, ACTIVITY_META.predecessors)).filter((id) => id !== currentActivityId)
  );
  const nextPredecessors = new Set(
    getActivityIdsFromRefs(getDependencyRefs(nextCustomFields, ACTIVITY_META.predecessors)).filter((id) => id !== currentActivityId)
  );
  const previousSuccessors = new Set(
    getActivityIdsFromRefs(getDependencyRefs(previousCustomFields, ACTIVITY_META.successors)).filter((id) => id !== currentActivityId)
  );
  const nextSuccessors = new Set(
    getActivityIdsFromRefs(getDependencyRefs(nextCustomFields, ACTIVITY_META.successors)).filter((id) => id !== currentActivityId)
  );

  const workingCustomFields = new Map<string, Activity['customFields']>();

  const ensureCustomFields = (activityId: string) => {
    if (workingCustomFields.has(activityId)) {
      return workingCustomFields.get(activityId)!;
    }

    const activity = activities.find((item) => item.id === activityId);
    if (!activity) {
      return null;
    }

    const snapshot = { ...activity.customFields };
    workingCustomFields.set(activityId, snapshot);
    return snapshot;
  };

  const mutateRefs = (activityId: string, key: string, mode: 'add' | 'remove') => {
    const customFields = ensureCustomFields(activityId);
    if (!customFields) {
      return;
    }

    const currentRefs = getDependencyRefs(customFields, key);
    customFields[key] = mode === 'add'
      ? addActivityRef(currentRefs, currentActivityId)
      : removeActivityRef(currentRefs, currentActivityId);
  };

  previousPredecessors.forEach((activityId) => {
    if (!nextPredecessors.has(activityId)) {
      mutateRefs(activityId, ACTIVITY_META.successors, 'remove');
    }
  });
  nextPredecessors.forEach((activityId) => {
    if (!previousPredecessors.has(activityId)) {
      mutateRefs(activityId, ACTIVITY_META.successors, 'add');
    }
  });

  previousSuccessors.forEach((activityId) => {
    if (!nextSuccessors.has(activityId)) {
      mutateRefs(activityId, ACTIVITY_META.predecessors, 'remove');
    }
  });
  nextSuccessors.forEach((activityId) => {
    if (!previousSuccessors.has(activityId)) {
      mutateRefs(activityId, ACTIVITY_META.predecessors, 'add');
    }
  });

  return Array.from(workingCustomFields.entries()).map(([id, customFields]) => ({
    id,
    customFields: createMetaPatch(customFields),
  }));
}

export function getSubtasks(activity: Activity): ActivitySubtask[] {
  const value = activity.customFields[ACTIVITY_META.subtasks];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ActivitySubtask => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      'title' in item &&
      'completed' in item &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.completed === 'boolean'
    );
  });
}

export function getRecurrence(activity: Activity): ActivityRecurrence | null {
  const value = activity.customFields[ACTIVITY_META.recurrence];
  if (!isObject(value) || typeof value.frequency !== 'string') {
    return null;
  }

  return value as unknown as ActivityRecurrence;
}

export function withActivityMeta(activity: Activity, patch: Record<string, JsonValue>) {
  return {
    ...activity,
    customFields: {
      ...activity.customFields,
      ...patch,
    },
  };
}

export function createMetaPatch(patch: Record<string, JsonValue>) {
  return patch;
}

export function getActivityDateScore(activity: Activity, referenceDate: string) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? activity.customFields.dueDate : null;
  const scheduledDate = getScheduledDate(activity);
  const relevantDate = dueDate || scheduledDate;

  if (!relevantDate) {
    return null;
  }

  return relevantDate.localeCompare(referenceDate);
}

export function isOverdueActivity(activity: Activity, referenceDate: string) {
  const score = getActivityDateScore(activity, referenceDate);
  return score !== null && score < 0 && !activity.completed;
}

export function isDueToday(activity: Activity, referenceDate: string) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? activity.customFields.dueDate : null;
  const scheduledDate = getScheduledDate(activity);
  return dueDate === referenceDate || scheduledDate === referenceDate || getActivityBucket(activity) === 'today';
}

export function shouldShowInToday(activity: Activity, referenceDate: string) {
  if (activity.completed) {
    return false;
  }

  return isOverdueActivity(activity, referenceDate) || isDueToday(activity, referenceDate);
}

export function collectSearchableText(value: JsonValue): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSearchableText(item));
  }

  return Object.values(value).flatMap((item) => collectSearchableText(item));
}

export function deriveProjects(activities: Activity[]) {
  return Array.from(
    new Set(
      activities
        .map((activity) => getProjectName(activity).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function deriveAreas(activities: Activity[]) {
  return Array.from(
    new Set(
      activities
        .map((activity) => getAreaName(activity).trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function nextRecurrenceDate(fromDate: string, recurrence: ActivityRecurrence) {
  const base = parseDateKey(fromDate);
  const step = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;

  switch (recurrence.frequency) {
    case 'daily':
      base.setDate(base.getDate() + step);
      break;
    case 'weekdays': {
      do {
        base.setDate(base.getDate() + 1);
      } while ([0, 6].includes(base.getDay()));
      break;
    }
    case 'weekly':
      base.setDate(base.getDate() + 7 * step);
      break;
    case 'monthly':
      base.setMonth(base.getMonth() + step);
      if (recurrence.dayOfMonth) {
        base.setDate(Math.min(recurrence.dayOfMonth, 28));
      }
      break;
  }

  return formatDateKey(base);
}
