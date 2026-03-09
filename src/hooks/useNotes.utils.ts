import type { DailyNote } from '@/types';

export const cloneNotesSnapshot = (items: DailyNote[]) =>
  JSON.parse(JSON.stringify(items)) as DailyNote[];

export function upsertNoteSnapshot(items: DailyNote[], note: DailyNote) {
  const index = items.findIndex((item) => item.date === note.date);

  if (index === -1) {
    return [...items, note];
  }

  const next = [...items];
  next[index] = note;
  return next;
}
