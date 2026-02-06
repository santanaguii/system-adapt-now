import { useRef, useEffect, useMemo } from 'react';
import { NoteLine as NoteLineType } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface NoteLineProps {
  line: NoteLineType;
  isFocused: boolean;
  onUpdate: (updates: Partial<NoteLineType>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  onToggleCollapse: () => void;
  highlightTerms?: string[];
  hasChildren?: boolean;
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
  onUpdate, 
  onKeyDown, 
  onFocus, 
  onToggleCollapse,
  highlightTerms = [],
  hasChildren = false
}: NoteLineProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isFocused]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [line.content]);

  const isCollapsible = (line.type === 'title' || line.type === 'subtitle') && hasChildren;
  const indentClass = line.indent ? `ml-${line.indent * 4}` : '';

  // Highlight matching terms in content
  const highlightedContent = useMemo(() => {
    if (highlightTerms.length === 0 || !line.content) return null;
    
    let result = line.content;
    const parts: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    
    const pattern = new RegExp(`(${highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    let match;
    
    while ((match = pattern.exec(line.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: line.content.slice(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[0], highlight: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < line.content.length) {
      parts.push({ text: line.content.slice(lastIndex), highlight: false });
    }
    
    return parts.length > 0 ? parts : null;
  }, [line.content, highlightTerms]);

  return (
    <div className={cn('group relative flex items-start gap-1', indentClass)}>
      {/* Collapse toggle for titles/subtitles */}
      {isCollapsible && (
        <button
          onClick={onToggleCollapse}
          className="flex-shrink-0 mt-1 p-0.5 rounded hover:bg-muted transition-colors"
        >
          {line.collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
      
      {/* Spacer for non-collapsible lines to maintain alignment */}
      {!isCollapsible && (line.type === 'title' || line.type === 'subtitle') && (
        <div className="w-5 flex-shrink-0" />
      )}

      <div className="flex-1">
        {highlightedContent && highlightTerms.length > 0 && !isFocused ? (
          <div
            className={cn(
              'w-full whitespace-pre-wrap',
              lineTypeClasses[line.type] || lineTypeClasses.paragraph
            )}
            onClick={onFocus}
          >
            {highlightedContent.map((part, i) => (
              <span
                key={i}
                className={part.highlight ? 'bg-yellow-200 dark:bg-yellow-800 rounded px-0.5' : ''}
              >
                {part.text}
              </span>
            ))}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={line.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            placeholder={
              line.type === 'title' 
                ? 'Título...' 
                : line.type === 'subtitle' 
                  ? 'Subtítulo...' 
                  : 'Escreva aqui...'
            }
            className={cn(
              'w-full bg-transparent border-none outline-none resize-none overflow-hidden',
              'placeholder:text-muted-foreground/50',
              lineTypeClasses[line.type] || lineTypeClasses.paragraph
            )}
            rows={1}
          />
        )}
      </div>
    </div>
  );
}
