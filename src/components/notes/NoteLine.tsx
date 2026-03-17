import { useRef, useEffect, useState } from 'react';
import { NoteLine as NoteLineType } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface NoteLineProps {
  line: NoteLineType;
  isFocused: boolean;
  isSelected?: boolean;
  isSearchMatch?: boolean;
  searchFlashKey?: string | null;
  onUpdate: (updates: Partial<NoteLineType>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPasteText?: (text: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onFocus: () => void;
  onToggleCollapse: () => void;
  hasChildren?: boolean;
  selectionRequest?: { start: number; end: number; key: number } | null;
}

const lineTypeClasses: Record<string, string> = {
  title: 'text-3xl font-bold text-editor-title py-0.5 tracking-tight',
  subtitle: 'text-xl font-semibold text-editor-subtitle py-0.5 border-b border-border/40 pb-1',
  quote: 'pl-4 border-l-4 border-editor-quote text-editor-quote italic bg-editor-quote-bg py-1 rounded-r-md',
  paragraph: 'text-base text-foreground',
  bullet: 'text-base text-foreground pl-7 relative before:content-["•"] before:absolute before:left-1.5 before:text-primary before:font-bold before:text-lg',
  comment: 'text-sm text-muted-foreground/70 italic pl-4 py-0.5',
};

const lineTypeStyles: Record<string, React.CSSProperties> = {
  title: { lineHeight: 'var(--note-line-height-heading)' },
  subtitle: { lineHeight: 'var(--note-line-height-heading)' },
  quote: { lineHeight: 'var(--note-line-height-quote)' },
  paragraph: { lineHeight: 'var(--note-line-height-paragraph)' },
  bullet: { lineHeight: 'var(--note-line-height-paragraph)' },
  comment: { lineHeight: 'var(--note-line-height-comment)' },
};

export function NoteLine({
  line,
  isFocused,
  isSelected = false,
  isSearchMatch = false,
  searchFlashKey = null,
  onUpdate,
  onKeyDown,
  onPasteText,
  onMouseDown,
  onFocus,
  onToggleCollapse,
  hasChildren = false,
  selectionRequest,
}: NoteLineProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const appliedSelectionKeyRef = useRef<number | null>(null);
  const [isSearchFlashActive, setIsSearchFlashActive] = useState(false);
  const selectionStart = selectionRequest?.start;
  const selectionEnd = selectionRequest?.end;
  const selectionKey = selectionRequest?.key;

  useEffect(() => {
    if (isFocused && inputRef.current && !selectionRequest && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isFocused, selectionRequest]);

  useEffect(() => {
    if (
      isFocused &&
      inputRef.current &&
      selectionKey !== undefined &&
      selectionStart !== undefined &&
      selectionEnd !== undefined &&
      appliedSelectionKeyRef.current !== selectionKey
    ) {
      appliedSelectionKeyRef.current = selectionKey;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(selectionStart, selectionEnd);
    }
  }, [isFocused, selectionEnd, selectionKey, selectionStart]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [line.content]);

  useEffect(() => {
    if (!isSearchMatch || !searchFlashKey) {
      setIsSearchFlashActive(false);
      return;
    }

    setIsSearchFlashActive(false);
    const frameId = window.requestAnimationFrame(() => {
      setIsSearchFlashActive(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isSearchMatch, searchFlashKey]);

  const isCollapsible = (line.type === 'title' || line.type === 'subtitle') && hasChildren;
  const indentClass = line.indent ? `ml-${line.indent * 4}` : '';

  return (
    <div
      data-note-line-id={line.id}
      className={cn(
        'group relative flex items-start gap-1 rounded-md',
        indentClass,
        isSelected && 'bg-primary/5',
        isSearchFlashActive && 'note-search-flash'
      )}
      onMouseDown={onMouseDown}
    >
      {isCollapsible && (
        <button onClick={onToggleCollapse} className="mt-1 flex-shrink-0 rounded p-0.5 transition-colors hover:bg-muted">
          {line.collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}

      {!isCollapsible && (line.type === 'title' || line.type === 'subtitle') && <div className="w-5 flex-shrink-0" />}

      <div className="flex-1">
        <textarea
          ref={inputRef}
          value={line.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pastedText = e.clipboardData.getData('text/plain');
            if (onPasteText && pastedText.includes('\n')) {
              e.preventDefault();
              onPasteText(pastedText);
            }
          }}
          onFocus={onFocus}
          placeholder={
            line.type === 'title'
              ? 'Titulo...'
              : line.type === 'subtitle'
                ? 'Subtitulo...'
                : line.type === 'comment'
                  ? 'Comentario...'
                  : 'Escreva aqui...'
          }
          className={cn(
            'w-full resize-none overflow-hidden border-none bg-transparent outline-none',
            'placeholder:text-muted-foreground/50',
            lineTypeClasses[line.type] || lineTypeClasses.paragraph
          )}
          style={lineTypeStyles[line.type] || lineTypeStyles.paragraph}
          rows={1}
        />
      </div>
    </div>
  );
}
