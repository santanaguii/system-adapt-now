import { LineType, NoteLine, NoteTemplate } from '@/types';

function createTemplate(id: string, name: string, lines: Array<Pick<NoteLine, 'content' | 'type'>>): NoteTemplate {
  return { id, name, lines };
}

export const defaultNoteTemplates: NoteTemplate[] = [
  createTemplate('meeting', 'Ata / reuniao', [
    { content: 'Reuniao', type: 'title' },
    { content: 'Participantes', type: 'subtitle' },
    { content: '', type: 'bullet' },
    { content: 'Decisoes', type: 'subtitle' },
    { content: '', type: 'bullet' },
    { content: 'Pendencias', type: 'subtitle' },
    { content: '', type: 'bullet' },
  ]),
  createTemplate('site-diary', 'Diario de obra', [
    { content: 'Diario de obra', type: 'title' },
    { content: 'Frentes ativas', type: 'subtitle' },
    { content: '', type: 'bullet' },
    { content: 'Riscos / interferencias', type: 'subtitle' },
    { content: '', type: 'bullet' },
    { content: 'Proximos passos', type: 'subtitle' },
    { content: '', type: 'bullet' },
  ]),
  createTemplate('follow-up', 'Follow-up', [
    { content: 'Follow-up', type: 'title' },
    { content: 'Aguardando retorno de', type: 'subtitle' },
    { content: '', type: 'bullet' },
    { content: 'Proxima cobranca', type: 'subtitle' },
    { content: '', type: 'bullet' },
  ]),
  createTemplate('pending', 'Pendencias do dia', [
    { content: 'Pendencias do dia', type: 'title' },
    { content: '', type: 'bullet' },
    { content: '', type: 'bullet' },
    { content: '', type: 'bullet' },
  ]),
];

function templateStorageKey(userId: string) {
  return `note-templates:${userId}`;
}

function isLineType(value: string): value is LineType {
  return ['paragraph', 'title', 'subtitle', 'quote', 'bullet', 'comment'].includes(value);
}

export function normalizeNoteTemplates(value: unknown): NoteTemplate[] {
  if (!Array.isArray(value)) {
    return defaultNoteTemplates;
  }

  const templates = value.flatMap((template) => {
    if (!template || typeof template !== 'object') {
      return [];
    }

    const candidate = template as Partial<NoteTemplate>;
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : crypto.randomUUID();
    const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'Novo template';
    const lines = Array.isArray(candidate.lines)
      ? candidate.lines.flatMap((line) => {
          if (!line || typeof line !== 'object') {
            return [];
          }
          const candidateLine = line as Partial<Pick<NoteLine, 'content' | 'type'>>;
          return typeof candidateLine.content === 'string' && typeof candidateLine.type === 'string' && isLineType(candidateLine.type)
            ? [{ content: candidateLine.content, type: candidateLine.type }]
            : [];
        })
      : [];

    return [{ id, name, lines: lines.length > 0 ? lines : [{ content: '', type: 'paragraph' as const }] }];
  });

  return templates.length > 0 ? templates : defaultNoteTemplates;
}

export function areNoteTemplatesEqual(left: NoteTemplate[], right: NoteTemplate[]) {
  return JSON.stringify(normalizeNoteTemplates(left)) === JSON.stringify(normalizeNoteTemplates(right));
}

export function readNoteTemplates(userId: string | null | undefined) {
  if (!userId || typeof window === 'undefined') {
    return defaultNoteTemplates;
  }

  try {
    const raw = window.localStorage.getItem(templateStorageKey(userId));
    return raw ? normalizeNoteTemplates(JSON.parse(raw)) : defaultNoteTemplates;
  } catch (error) {
    console.error('Error reading note templates:', error);
    return defaultNoteTemplates;
  }
}

export function writeNoteTemplates(userId: string | null | undefined, templates: NoteTemplate[]) {
  if (!userId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(templateStorageKey(userId), JSON.stringify(templates));
  } catch (error) {
    console.error('Error writing note templates:', error);
  }
}

export function getTemplateById(templateId: string, templates: NoteTemplate[] = defaultNoteTemplates) {
  return templates.find((template) => template.id === templateId) ?? templates[0] ?? defaultNoteTemplates[0];
}

export function serializeNoteTemplateLines(lines: Array<Pick<NoteLine, 'content' | 'type'>>) {
  return lines.map((line) => {
    switch (line.type) {
      case 'title':
        return `# ${line.content}`.trimEnd();
      case 'subtitle':
        return `## ${line.content}`.trimEnd();
      case 'bullet':
        return `- ${line.content}`.trimEnd();
      case 'quote':
        return `> ${line.content}`.trimEnd();
      case 'comment':
        return `// ${line.content}`.trimEnd();
      default:
        return line.content;
    }
  }).join('\n');
}

export function parseNoteTemplateLines(value: string): Array<Pick<NoteLine, 'content' | 'type'>> {
  return value.replace(/\r\n/g, '\n').split('\n').map((line) => {
    if (line === '#') return { content: '', type: 'title' as const };
    if (line.startsWith('# ')) return { content: line.slice(2), type: 'title' as const };
    if (line === '##') return { content: '', type: 'subtitle' as const };
    if (line.startsWith('## ')) return { content: line.slice(3), type: 'subtitle' as const };
    if (line === '-') return { content: '', type: 'bullet' as const };
    if (line.startsWith('- ')) return { content: line.slice(2), type: 'bullet' as const };
    if (line === '>') return { content: '', type: 'quote' as const };
    if (line.startsWith('> ')) return { content: line.slice(2), type: 'quote' as const };
    if (line === '//') return { content: '', type: 'comment' as const };
    if (line.startsWith('// ')) return { content: line.slice(3), type: 'comment' as const };
    return { content: line, type: 'paragraph' as const };
  });
}
