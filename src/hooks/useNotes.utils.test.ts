import { describe, expect, it } from 'vitest';
import type { DailyNote } from '@/types';
import { cloneNotesSnapshot, upsertNoteSnapshot } from './useNotes.utils';

const originalNotes: DailyNote[] = [
  {
    date: '2026-03-07',
    lines: [{ id: 'line-1', content: 'conteúdo original', type: 'paragraph' }],
    updatedAt: new Date('2026-03-07T10:00:00.000Z'),
  },
];

describe('useNotes utils', () => {
  it('clones snapshots without sharing references', () => {
    const snapshot = cloneNotesSnapshot(originalNotes);

    snapshot[0].lines[0].content = 'alterado';

    expect(originalNotes[0].lines[0].content).toBe('conteúdo original');
  });

  it('replaces an existing note instead of duplicating the date', () => {
    const replacement: DailyNote = {
      date: '2026-03-07',
      lines: [{ id: 'line-1', content: 'versão salva', type: 'paragraph' }],
      updatedAt: new Date('2026-03-07T12:00:00.000Z'),
    };

    const result = upsertNoteSnapshot(originalNotes, replacement);

    expect(result).toHaveLength(1);
    expect(result[0].lines[0].content).toBe('versão salva');
    expect(originalNotes[0].lines[0].content).toBe('conteúdo original');
  });
});
