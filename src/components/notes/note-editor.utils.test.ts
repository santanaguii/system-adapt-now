import { describe, expect, it } from 'vitest';
import { applyLineMarkdownShortcut, createNoteTemplate, getNextLineType, normalizePastedLines } from './note-editor.utils';
import { defaultNoteTemplates } from '@/lib/note-templates';

describe('note-editor utils', () => {
  it('applies markdown shortcuts to note types', () => {
    expect(applyLineMarkdownShortcut('#')).toEqual({ content: '', type: 'title' });
    expect(applyLineMarkdownShortcut('##')).toEqual({ content: '', type: 'subtitle' });
    expect(applyLineMarkdownShortcut('-')).toEqual({ content: '', type: 'bullet' });
    expect(applyLineMarkdownShortcut('//')).toEqual({ content: '', type: 'comment' });
    expect(applyLineMarkdownShortcut('# Reuniao alinhamento')).toEqual({ content: 'Reuniao alinhamento', type: 'title' });
    expect(applyLineMarkdownShortcut('>Observacao tecnica')).toEqual({ content: 'Observacao tecnica', type: 'quote' });
    expect(applyLineMarkdownShortcut('abc')).toBeNull();
  });

  it('keeps list-like lines continuing on enter', () => {
    expect(getNextLineType('bullet', 'Item')).toBe('bullet');
    expect(getNextLineType('quote', 'Texto')).toBe('quote');
    expect(getNextLineType('title', 'Cabecalho')).toBe('paragraph');
    expect(getNextLineType('bullet', '')).toBe('paragraph');
  });

  it('normalizes pasted content and templates', () => {
    expect(normalizePastedLines('- item 1\n> observacao')).toEqual([
      { content: 'item 1', type: 'bullet' },
      { content: 'observacao', type: 'quote' },
    ]);

    expect(normalizePastedLines('##Planejamento\n//Observacao')).toEqual([
      { content: 'Planejamento', type: 'subtitle' },
      { content: 'Observacao', type: 'comment' },
    ]);

    expect(createNoteTemplate('meeting', defaultNoteTemplates)[0]).toEqual({ content: 'Reuniao', type: 'title' });
  });
});
