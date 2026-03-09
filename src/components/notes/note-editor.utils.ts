import { LineType, NoteLine, NoteTemplate } from '@/types';
import { defaultNoteTemplates, getTemplateById } from '@/lib/note-templates';

export function applyLineMarkdownShortcut(content: string): { content: string; type: LineType } | null {
  const match = content.match(/^\s*(##|\/\/|#|-|\*|>)(.*)$/);
  if (!match) {
    return null;
  }

  const [, prefix, remainder] = match;
  const normalizedContent = remainder.replace(/^\s+/, '');

  switch (prefix) {
    case '##':
      return { content: normalizedContent, type: 'subtitle' };
    case '#':
      return { content: normalizedContent, type: 'title' };
    case '-':
    case '*':
      return { content: normalizedContent, type: 'bullet' };
    case '>':
      return { content: normalizedContent, type: 'quote' };
    case '//':
      return { content: normalizedContent, type: 'comment' };
    default:
      return null;
  }
}

export function getNextLineType(currentType: LineType, content: string): LineType {
  if (!content.trim()) {
    return 'paragraph';
  }

  if (currentType === 'bullet' || currentType === 'quote' || currentType === 'comment') {
    return currentType;
  }

  return 'paragraph';
}

export function normalizePastedLines(text: string): Array<{ content: string; type: LineType }> {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const shortcut = applyLineMarkdownShortcut(line);

      if (!shortcut) {
        return {
          content: line,
          type: 'paragraph' as LineType,
        };
      }

      return shortcut;
    });
}

export function createNoteTemplate(templateId: string, templates: NoteTemplate[] = defaultNoteTemplates) {
  return getTemplateById(templateId, templates).lines;
}
