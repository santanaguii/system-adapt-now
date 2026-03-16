export interface ActivityScheduleEntry {
  id: string;
  activityId: string;
  date: string;
  startMinute: number | null;
  durationMinutes: number | null;
  isAllDay: boolean;
  isLocked?: boolean;
  lockLabel?: string | null;
  createdAt: string;
}

export interface ActivityScheduleSegment {
  startMinute: number;
  endMinute: number;
}

export const WORK_SLOT_MINUTES = 10;

export const WORK_PERIODS = [
  { start: 8 * 60 + 30, end: 12 * 60 },
  { start: 13 * 60 + 30, end: 18 * 60 },
] as const;

export const WORKDAY_TOTAL_MINUTES = WORK_PERIODS.reduce((total, period) => total + (period.end - period.start), 0);

export const WORK_SLOT_STARTS = WORK_PERIODS.flatMap((period) => {
  const starts: number[] = [];

  for (let minute = period.start; minute < period.end; minute += WORK_SLOT_MINUTES) {
    starts.push(minute);
  }

  return starts;
});

function findWorkPeriod(minute: number) {
  return WORK_PERIODS.find((period) => minute >= period.start && minute < period.end) || null;
}

export function formatScheduleTime(minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatScheduleDuration(durationMinutes: number | null, isAllDay = false) {
  if (isAllDay || durationMinutes === null) {
    return 'Dia todo';
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes} min`;
}

export function getScheduleDurationOptions() {
  const options = [];

  for (let duration = WORK_SLOT_MINUTES; duration <= WORKDAY_TOTAL_MINUTES; duration += WORK_SLOT_MINUTES) {
    options.push({
      value: String(duration),
      label: formatScheduleDuration(duration),
    });
  }

  return options;
}

export function getScheduleStartOptions() {
  return WORK_SLOT_STARTS.map((minute) => ({
    value: String(minute),
    label: formatScheduleTime(minute),
  }));
}

export function addWorkingMinutes(startMinute: number, durationMinutes: number) {
  if (durationMinutes <= 0 || durationMinutes > WORKDAY_TOTAL_MINUTES) {
    return null;
  }

  let currentMinute = startMinute;
  let remaining = durationMinutes;

  while (remaining > 0) {
    const currentPeriod = findWorkPeriod(currentMinute);
    if (!currentPeriod) {
      return null;
    }

    const availableInPeriod = currentPeriod.end - currentMinute;
    if (remaining <= availableInPeriod) {
      return currentMinute + remaining;
    }

    remaining -= availableInPeriod;
    const nextPeriod = WORK_PERIODS.find((period) => period.start >= currentPeriod.end);
    if (!nextPeriod) {
      return null;
    }

    currentMinute = nextPeriod.start;
  }

  return currentMinute;
}

export function getScheduleEntrySegments(entry: ActivityScheduleEntry): ActivityScheduleSegment[] {
  if (entry.isAllDay || entry.startMinute === null || entry.durationMinutes === null) {
    return [];
  }

  let currentMinute = entry.startMinute;
  let remaining = entry.durationMinutes;
  const segments: ActivityScheduleSegment[] = [];

  while (remaining > 0) {
    const currentPeriod = findWorkPeriod(currentMinute);
    if (!currentPeriod) {
      return [];
    }

    const availableInPeriod = currentPeriod.end - currentMinute;
    const consumed = Math.min(remaining, availableInPeriod);

    segments.push({
      startMinute: currentMinute,
      endMinute: currentMinute + consumed,
    });

    remaining -= consumed;
    if (remaining <= 0) {
      break;
    }

    const nextPeriod = WORK_PERIODS.find((period) => period.start >= currentPeriod.end);
    if (!nextPeriod) {
      return [];
    }

    currentMinute = nextPeriod.start;
  }

  return segments;
}

export function getScheduleEntryEndMinute(entry: ActivityScheduleEntry) {
  if (entry.isAllDay || entry.startMinute === null || entry.durationMinutes === null) {
    return null;
  }

  return addWorkingMinutes(entry.startMinute, entry.durationMinutes);
}

function segmentsOverlap(a: ActivityScheduleSegment[], b: ActivityScheduleSegment[]) {
  return a.some((segmentA) =>
    b.some((segmentB) => segmentA.startMinute < segmentB.endMinute && segmentB.startMinute < segmentA.endMinute)
  );
}

export function hasScheduleConflict(entry: ActivityScheduleEntry, otherEntries: ActivityScheduleEntry[]) {
  if (entry.isAllDay) {
    return false;
  }

  const entrySegments = getScheduleEntrySegments(entry);
  if (entrySegments.length === 0) {
    return true;
  }

  return otherEntries.some((otherEntry) => {
    if (otherEntry.id === entry.id || otherEntry.isAllDay) {
      return false;
    }

    return segmentsOverlap(entrySegments, getScheduleEntrySegments(otherEntry));
  });
}

export function findNextScheduleStart(entries: ActivityScheduleEntry[], durationMinutes: number) {
  if (durationMinutes <= 0 || durationMinutes > WORKDAY_TOTAL_MINUTES) {
    return null;
  }

  const requiredSlots = durationMinutes / WORK_SLOT_MINUTES;
  const occupied = new Set<number>();

  entries
    .filter((entry) => !entry.isAllDay)
    .forEach((entry) => {
      getScheduleEntrySegments(entry).forEach((segment) => {
        for (let minute = segment.startMinute; minute < segment.endMinute; minute += WORK_SLOT_MINUTES) {
          const slotIndex = WORK_SLOT_STARTS.indexOf(minute);
          if (slotIndex >= 0) {
            occupied.add(slotIndex);
          }
        }
      });
    });

  for (let index = 0; index <= WORK_SLOT_STARTS.length - requiredSlots; index += 1) {
    const hasGap = Array.from({ length: requiredSlots }, (_, offset) => index + offset).some((slotIndex) => occupied.has(slotIndex));
    if (!hasGap) {
      return WORK_SLOT_STARTS[index];
    }
  }

  return null;
}

export function sortScheduleEntries(entries: ActivityScheduleEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) {
      return a.isAllDay ? -1 : 1;
    }

    if (a.isAllDay && b.isAllDay) {
      return a.createdAt.localeCompare(b.createdAt);
    }

    return (a.startMinute ?? 0) - (b.startMinute ?? 0);
  });
}

export function getWorkMinutesBefore(minute: number) {
  let total = 0;

  for (const period of WORK_PERIODS) {
    if (minute >= period.end) {
      total += period.end - period.start;
      continue;
    }

    if (minute > period.start) {
      total += minute - period.start;
    }

    break;
  }

  return total;
}
