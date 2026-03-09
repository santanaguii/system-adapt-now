import { useRef, useEffect, useState } from 'react';
import { NoteLine as NoteLineType } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight, ChevronDown, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onCreateActivity?: () => void;
  activityCreated?: boolean;
  selectionRequest?: { start: number; end: number; key: number } | null;
}

const lineTypeClasses: Record<string, string> = {
  title: 'text-3xl font-bold text-editor-title leading-tight py-2 tracking-tight',
  subtitle: 'text-xl font-semibold text-editor-subtitle leading-snug py-1.5 border-b border-border/40 pb-2',
  quote: 'pl-4 border-l-4 border-editor-quote text-editor-quote italic bg-editor-quote-bg py-2 rounded-r-md',
  paragraph: 'text-base text-foreground leading-relaxed',
  bullet: 'text-base text-foreground pl-7 relative before:content-["•"] before:absolute before:left-1.5 before:text-primary before:font-bold before:text-lg',
  comment: 'text-sm text-muted-foreground/70 italic pl-4',
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
  onCreateActivity,
  activityCreated = false,
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
          rows={1}
        />
      </div>

      {activityCreated ? (
        <div
          className={cn(
            'pointer-events-none flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-emerald-700 transition-opacity dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
            isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          title="Atividade criada a partir desta nota"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs">Atividade criada</span>
        </div>
      ) : onCreateActivity && line.content.trim() ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={onCreateActivity}
          title="Virar atividade"
        >
          <Link2 className="h-4 w-4" />
          <span className="text-xs">Virar atividade</span>
        </Button>
      ) : null}
    </div>
  );
}
