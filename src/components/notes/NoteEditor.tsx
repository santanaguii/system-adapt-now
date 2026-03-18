import { useState, useEffect, useRef, useCallback } from 'react';
import { DailyNote, NoteLine, LineType, NoteTemplate } from '@/types';
import { NoteLine as NoteLineComponent } from './NoteLine';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileStack,
  Heading1,
  Heading2,
  List,
  Loader2,
  MessageSquare,
  MessageSquareOff,
  Quote,
  Redo2,
  Save,
  Type,
  Undo2,
  Check,
  AlertCircle,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SaveStatus } from '@/hooks/useNotes';
import { applyLineMarkdownShortcut, createNoteTemplate, getNextLineType, normalizePastedLines } from './note-editor.utils';

interface NoteEditorProps {
  currentDate: Date;
  note: DailyNote;
  onDateChange: (date: Date) => void;
  onUpdateLine: (lineId: string, updates: Partial<NoteLine>) => void;
  onAddLine: (afterLineId?: string, type?: LineType) => string;
  onDeleteLine: (lineId: string) => void;
  onToggleCollapse: (lineId: string) => void;
  onUpdateIndent: (lineId: string, delta: number) => void;
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  autosaveEnabled: boolean;
  showDateButtons?: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCreateActivityFromLine?: (line: NoteLine) => void;
  onOpenDetailedActivityFromLine?: (line: NoteLine) => void;
  activityCreatedLineIds?: string[];
  highlightedLineIds?: string[];
  searchFocusKey?: string | null;
  noteTemplates?: NoteTemplate[];
}

export function NoteEditor({
  currentDate,
  note,
  onDateChange,
  onUpdateLine,
  onAddLine,
  onDeleteLine,
  onToggleCollapse,
  onUpdateIndent,
  saveStatus,
  hasUnsavedChanges,
  autosaveEnabled,
  showDateButtons = true,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCreateActivityFromLine,
  onOpenDetailedActivityFromLine,
  activityCreatedLineIds = [],
  highlightedLineIds = [],
  searchFocusKey = null,
  noteTemplates = [],
}: NoteEditorProps) {
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [selectionRequest, setSelectionRequest] = useState<{ lineId: string; start: number; end: number; key: number } | null>(null);
  const [hideComments, setHideComments] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        onRedo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onUndo, onRedo]);

  useEffect(() => {
    const handleCopySelection = async (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c' || selectedLineIds.length <= 1) {
        return;
      }

      const orderedLines = note.lines.filter((line) => selectedLineIds.includes(line.id));
      const text = orderedLines.map((line) => line.content).join('\n');
      if (!text.trim()) {
        return;
      }

      event.preventDefault();
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        console.error('Error copying note lines:', error);
      }
    };

    window.addEventListener('keydown', handleCopySelection);
    return () => window.removeEventListener('keydown', handleCopySelection);
  }, [note.lines, selectedLineIds]);

  useEffect(() => {
    if (!searchFocusKey || highlightedLineIds.length === 0) {
      return;
    }

    const primaryMatchId = highlightedLineIds[0];
    if (!primaryMatchId) {
      return;
    }

    requestAnimationFrame(() => {
      const target = editorRef.current?.querySelector<HTMLElement>(`[data-note-line-id="${primaryMatchId}"]`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [highlightedLineIds, searchFocusKey]);

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const getVisibleLines = useCallback(() => {
    const lines = note.lines;
    const visibleLines: NoteLine[] = [];
    let skipUntilLevel: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLevel = line.type === 'title' ? 1 : line.type === 'subtitle' ? 2 : 3;

      if (hideComments && line.type === 'comment') {
        continue;
      }

      if (skipUntilLevel !== null) {
        if (lineLevel <= skipUntilLevel) {
          skipUntilLevel = null;
        } else {
          continue;
        }
      }

      visibleLines.push(line);

      if (line.collapsed && (line.type === 'title' || line.type === 'subtitle')) {
        skipUntilLevel = lineLevel;
      }
    }

    return visibleLines;
  }, [note.lines, hideComments]);

  const visibleLines = getVisibleLines();
  const focusedLine = focusedLineId ? note.lines.find((line) => line.id === focusedLineId) || null : null;
  const canCreateActivityFromFocusedLine = Boolean(focusedLine && focusedLine.content.trim());
  const focusedLineAlreadyConverted = Boolean(focusedLine && activityCreatedLineIds.includes(focusedLine.id));

  const focusLineAt = useCallback((lineId: string, start: number, end = start) => {
    setFocusedLineId(lineId);
    setSelectionRequest({
      lineId,
      start,
      end,
      key: Date.now() + Math.random(),
    });
  }, []);

  const handleJoinWithPrevious = useCallback((lineId: string) => {
    const lineIndex = note.lines.findIndex((line) => line.id === lineId);
    if (lineIndex <= 0) {
      return false;
    }

    const previousLine = note.lines[lineIndex - 1];
    const currentLine = note.lines[lineIndex];
    const cursorPosition = previousLine.content.length;
    onUpdateLine(previousLine.id, { content: `${previousLine.content}${currentLine.content}` });
    onDeleteLine(currentLine.id);
    setSelectedLineIds([]);
    focusLineAt(previousLine.id, cursorPosition);
    return true;
  }, [focusLineAt, note.lines, onDeleteLine, onUpdateLine]);

  const handleJoinWithNext = useCallback((lineId: string) => {
    const lineIndex = note.lines.findIndex((line) => line.id === lineId);
    if (lineIndex < 0 || lineIndex >= note.lines.length - 1) {
      return false;
    }

    const currentLine = note.lines[lineIndex];
    const nextLine = note.lines[lineIndex + 1];
    const cursorPosition = currentLine.content.length;
    onUpdateLine(currentLine.id, { content: `${currentLine.content}${nextLine.content}` });
    onDeleteLine(nextLine.id);
    setSelectedLineIds([]);
    focusLineAt(currentLine.id, cursorPosition);
    return true;
  }, [focusLineAt, note.lines, onDeleteLine, onUpdateLine]);

  const handleSelectionRange = useCallback((targetLineId: string, direction: 'up' | 'down') => {
    const anchorId = selectionAnchorId || focusedLineId || targetLineId;
    const anchorIndex = visibleLines.findIndex((line) => line.id === anchorId);
    const currentIndex = visibleLines.findIndex((line) => line.id === targetLineId);
    const nextIndex = direction === 'up' ? Math.max(0, currentIndex - 1) : Math.min(visibleLines.length - 1, currentIndex + 1);
    const rangeStart = Math.min(anchorIndex, nextIndex);
    const rangeEnd = Math.max(anchorIndex, nextIndex);
    const ids = visibleLines.slice(rangeStart, rangeEnd + 1).map((line) => line.id);
    setSelectionAnchorId(anchorId);
    setSelectedLineIds(ids);
    focusLineAt(visibleLines[nextIndex].id, direction === 'up' ? 0 : visibleLines[nextIndex].content.length);
  }, [focusLineAt, focusedLineId, selectionAnchorId, visibleLines]);

  const handleLineMouseDown = useCallback((lineId: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      event.preventDefault();
      const anchorId = selectionAnchorId || focusedLineId || lineId;
      const anchorIndex = visibleLines.findIndex((line) => line.id === anchorId);
      const targetIndex = visibleLines.findIndex((line) => line.id === lineId);
      if (anchorIndex < 0 || targetIndex < 0) {
        return;
      }
      const ids = visibleLines
        .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
        .map((line) => line.id);
      setSelectionAnchorId(anchorId);
      setSelectedLineIds(ids);
      focusLineAt(lineId, 0, visibleLines[targetIndex].content.length);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      setSelectionAnchorId(lineId);
      setSelectedLineIds((prev) => prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]);
      focusLineAt(lineId, 0, visibleLines.find((line) => line.id === lineId)?.content.length ?? 0);
      return;
    }

    if (selectedLineIds.length > 1) {
      setSelectedLineIds([]);
      setSelectionAnchorId(null);
    }
  }, [focusLineAt, focusedLineId, selectedLineIds.length, selectionAnchorId, visibleLines]);

  const handleApplyType = useCallback((type: LineType) => {
    if (!focusedLineId) {
      return;
    }

    onUpdateLine(focusedLineId, { type });
  }, [focusedLineId, onUpdateLine]);

  const handleInsertStructuredLines = useCallback((anchorId: string | undefined, lines: Array<Pick<NoteLine, 'content' | 'type'>>) => {
    if (lines.length === 0) {
      return;
    }

    const anchorLine = anchorId ? note.lines.find((line) => line.id === anchorId) : null;

    if (anchorLine && anchorLine.content.trim() === '' && anchorLine.type === 'paragraph') {
      onUpdateLine(anchorLine.id, { content: lines[0].content, type: lines[0].type });
      let nextAnchor = anchorLine.id;

      lines.slice(1).forEach((line) => {
        const newLineId = onAddLine(nextAnchor, line.type);
        onUpdateLine(newLineId, { content: line.content, type: line.type });
        nextAnchor = newLineId;
      });

      setFocusedLineId(nextAnchor);
      return;
    }

    let nextAnchor = anchorId;
    lines.forEach((line) => {
      const newLineId = onAddLine(nextAnchor, line.type);
      onUpdateLine(newLineId, { content: line.content, type: line.type });
      nextAnchor = newLineId;
    });

    if (nextAnchor) {
      setFocusedLineId(nextAnchor);
    }
  }, [note.lines, onAddLine, onUpdateLine]);

  const handleInsertTemplate = useCallback((templateId: string) => {
    const templateLines = createNoteTemplate(templateId, noteTemplates);
    const anchorId = focusedLineId || note.lines[note.lines.length - 1]?.id;
    handleInsertStructuredLines(anchorId, templateLines);
  }, [focusedLineId, handleInsertStructuredLines, note.lines, noteTemplates]);

  const handlePasteText = useCallback((lineId: string, text: string) => {
    const normalizedLines = normalizePastedLines(text);
    if (normalizedLines.length === 0) {
      return;
    }

    onUpdateLine(lineId, normalizedLines[0]);
    let anchorId = lineId;
    normalizedLines.slice(1).forEach((line) => {
      const newLineId = onAddLine(anchorId, line.type);
      onUpdateLine(newLineId, { content: line.content, type: line.type });
      anchorId = newLineId;
    });
    setFocusedLineId(anchorId);
  }, [onAddLine, onUpdateLine]);

  const handleKeyDown = useCallback((lineId: string, e: React.KeyboardEvent) => {
    const allLines = note.lines;
    const lineIndex = allLines.findIndex((line) => line.id === lineId);
    const line = allLines[lineIndex];
    if (!line) {
      return;
    }

    const target = e.currentTarget as HTMLTextAreaElement;
    const caretAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
    const caretAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
    const hasRangeSelection = target.selectionStart !== target.selectionEnd;

    if (e.key === 'Escape') {
      setSelectedLineIds([]);
      setSelectionAnchorId(null);
      return;
    }

    if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      handleSelectionRange(lineId, 'up');
      return;
    }

    if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      handleSelectionRange(lineId, 'down');
      return;
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedLineIds.length > 1 && selectedLineIds.includes(lineId)) {
      e.preventDefault();
      const remainingLines = note.lines.filter((candidate) => !selectedLineIds.includes(candidate.id));
      selectedLineIds.forEach((selectedId) => onDeleteLine(selectedId));
      setSelectedLineIds([]);
      setSelectionAnchorId(null);
      if (remainingLines[0]) {
        focusLineAt(remainingLines[0].id, remainingLines[0].content.length);
      }
      return;
    }

    if (e.key === ' ' && !hasRangeSelection) {
      const shortcut = applyLineMarkdownShortcut(line.content);
      if (shortcut) {
        const prefixMatch = line.content.match(/^\s*(##|\/\/|#|-|\*|>)/);
        const prefixLength = prefixMatch ? prefixMatch[0].length : -1;
        if (target.selectionStart === prefixLength && target.selectionEnd === prefixLength) {
          e.preventDefault();
          onUpdateLine(lineId, shortcut);
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (!line.content.trim() && line.type !== 'paragraph') {
        onUpdateLine(lineId, { type: 'paragraph' });
        return;
      }

      const before = line.content.slice(0, target.selectionStart);
      const after = line.content.slice(target.selectionEnd);
      const nextType = hasRangeSelection || target.selectionStart < line.content.length
        ? line.type
        : getNextLineType(line.type, line.content);

      onUpdateLine(lineId, { content: before });
      const newLineId = onAddLine(lineId, nextType);
      onUpdateLine(newLineId, { content: after, type: nextType });
      setSelectedLineIds([]);
      setSelectionAnchorId(null);
      focusLineAt(newLineId, 0);
      return;
    }

    if (e.key === 'Backspace' && caretAtStart && !hasRangeSelection) {
      if (!line.content && line.type !== 'paragraph') {
        e.preventDefault();
        onUpdateLine(lineId, { type: 'paragraph' });
        return;
      }

      if (allLines.length > 1) {
        e.preventDefault();
        handleJoinWithPrevious(lineId);
        return;
      }
    }

    if (e.key === 'Delete' && caretAtEnd && !hasRangeSelection) {
      if (allLines.length > 1) {
        e.preventDefault();
        handleJoinWithNext(lineId);
        return;
      }
    }

    if (e.key === 'ArrowUp' && caretAtStart) {
      const visibleIndex = visibleLines.findIndex((visibleLine) => visibleLine.id === lineId);
      if (visibleIndex > 0) {
        e.preventDefault();
        setSelectedLineIds([]);
        setSelectionAnchorId(null);
        focusLineAt(visibleLines[visibleIndex - 1].id, visibleLines[visibleIndex - 1].content.length);
      }
    }

    if (e.key === 'ArrowDown' && caretAtEnd) {
      const visibleIndex = visibleLines.findIndex((visibleLine) => visibleLine.id === lineId);
      if (visibleIndex < visibleLines.length - 1) {
        e.preventDefault();
        setSelectedLineIds([]);
        setSelectionAnchorId(null);
        focusLineAt(visibleLines[visibleIndex + 1].id, 0);
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      onUpdateIndent(lineId, e.shiftKey ? -1 : 1);
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'title' });
          break;
        case '2':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'subtitle' });
          break;
        case '3':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'quote' });
          break;
        case '4':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'bullet' });
          break;
        case '0':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'paragraph' });
          break;
        case '5':
          e.preventDefault();
          onUpdateLine(lineId, { type: 'comment' });
          break;
        default:
          break;
      }
    }
  }, [focusLineAt, handleJoinWithNext, handleJoinWithPrevious, handleSelectionRange, note.lines, onAddLine, onDeleteLine, onUpdateIndent, onUpdateLine, selectedLineIds, visibleLines]);

  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  const renderSaveStatus = () => {
    if (!autosaveEnabled) {
      if (saveStatus === 'saving') {
        return <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Salvando...</span>;
      }
      if (saveStatus === 'saved') {
        return <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" />Salvo</span>;
      }
      if (saveStatus === 'error') {
        return <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />Erro ao salvar</span>;
      }
      if (hasUnsavedChanges) {
        return (
          <span className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400">Alteracoes nao salvas</span>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onSave}>
              <Save className="mr-1 h-3 w-3" />
              Salvar (Ctrl+S)
            </Button>
          </span>
        );
      }
      return <span className="text-muted-foreground">Salvamento manual</span>;
    }

    switch (saveStatus) {
      case 'saving':
        return <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Salvando...</span>;
      case 'saved':
        return <span className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" />Salvo</span>;
      case 'error':
        return <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />Erro ao salvar</span>;
      default:
        return <span className="text-muted-foreground">Salvo automaticamente</span>;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showDateButtons ? (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className={cn('h-8 px-3 font-medium', isToday && 'text-primary')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={currentDate} onSelect={(date) => date && onDateChange(date)} locale={ptBR} />
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className={cn('px-1 text-sm font-medium', isToday && 'text-primary')}>
              {format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
            </div>
          )}
          {isToday && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Hoje</span>}
        </div>

        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-3">
                <FileStack className="mr-2 h-4 w-4" />
                Templates
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <div className="space-y-1">
                {noteTemplates.map((template) => (
                  <Button key={template.id} variant="ghost" className="w-full justify-start" onClick={() => handleInsertTemplate(template.id)}>
                    {template.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
              variant={hideComments ? 'default' : 'ghost'}
              size="icon"
            className="h-8 w-8"
            onClick={() => setHideComments(!hideComments)}
            title={hideComments ? 'Mostrar comentarios' : 'Ocultar comentarios'}
          >
            {hideComments ? <MessageSquareOff className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Y)">
            <Redo2 className="h-4 w-4" />
          </Button>
          {!autosaveEnabled && (
            <Button variant={hasUnsavedChanges ? 'default' : 'ghost'} size="sm" className="h-8 px-3" onClick={onSave} disabled={!hasUnsavedChanges} title="Salvar (Ctrl+S)">
              <Save className="mr-1 h-4 w-4" />
              Salvar
            </Button>
          )}
        </div>
      </div>
      </div>

      <div className="shrink-0 border-b px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-0">
            <Button variant={focusedLine?.type === 'paragraph' ? 'default' : 'outline'} size="sm" className="rounded-r-none" onClick={() => handleApplyType('paragraph')} disabled={!focusedLine}>
              <Type className="mr-2 h-4 w-4" />
              Texto
            </Button>
            <Button variant={focusedLine?.type === 'title' ? 'default' : 'outline'} size="sm" className="rounded-none border-l-0" onClick={() => handleApplyType('title')} disabled={!focusedLine}>
              <Heading1 className="mr-2 h-4 w-4" />
              Titulo
            </Button>
            <Button variant={focusedLine?.type === 'subtitle' ? 'default' : 'outline'} size="sm" className="rounded-none border-l-0" onClick={() => handleApplyType('subtitle')} disabled={!focusedLine}>
              <Heading2 className="mr-2 h-4 w-4" />
              Subtitulo
            </Button>
            <Button variant={focusedLine?.type === 'bullet' ? 'default' : 'outline'} size="sm" className="rounded-none border-l-0" onClick={() => handleApplyType('bullet')} disabled={!focusedLine}>
              <List className="mr-2 h-4 w-4" />
              Topico
            </Button>
            <Button variant={focusedLine?.type === 'quote' ? 'default' : 'outline'} size="sm" className="rounded-none border-l-0" onClick={() => handleApplyType('quote')} disabled={!focusedLine}>
              <Quote className="mr-2 h-4 w-4" />
              Citacao
            </Button>
            <Button variant={focusedLine?.type === 'comment' ? 'default' : 'outline'} size="sm" className="rounded-l-none border-l-0" onClick={() => handleApplyType('comment')} disabled={!focusedLine}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Comentario
            </Button>
          </div>
          {(onOpenDetailedActivityFromLine || onCreateActivityFromLine) && (
            <Button
              variant={focusedLineAlreadyConverted ? 'default' : 'outline'}
              size="sm"
              disabled={!canCreateActivityFromFocusedLine || focusedLineAlreadyConverted}
              onClick={() => {
                if (!focusedLine || focusedLineAlreadyConverted) {
                  return;
                }
                if (onOpenDetailedActivityFromLine) {
                  onOpenDetailedActivityFromLine(focusedLine);
                  return;
                }
                onCreateActivityFromLine?.(focusedLine);
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {focusedLineAlreadyConverted ? 'Atividade criada' : 'Virar atividade'}
            </Button>
          )}
        </div>
      </div>

      <div ref={editorRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1">
          {visibleLines.map((line) => (
            <NoteLineComponent
              key={line.id}
              line={line}
              isFocused={focusedLineId === line.id}
              isSelected={selectedLineIds.includes(line.id)}
              isSearchMatch={highlightedLineIds.includes(line.id)}
              searchFlashKey={searchFocusKey}
              onUpdate={(updates) => onUpdateLine(line.id, updates)}
              onKeyDown={(e) => handleKeyDown(line.id, e)}
              onPasteText={(text) => handlePasteText(line.id, text)}
              onMouseDown={(event) => handleLineMouseDown(line.id, event)}
              onFocus={() => setFocusedLineId(line.id)}
              onToggleCollapse={() => onToggleCollapse(line.id)}
              selectionRequest={selectionRequest?.lineId === line.id ? { start: selectionRequest.start, end: selectionRequest.end, key: selectionRequest.key } : null}
              hasChildren={(line.type === 'title' || line.type === 'subtitle') && note.lines.some((candidate, index) => {
                const currentIndex = note.lines.findIndex((noteLine) => noteLine.id === line.id);
                if (index <= currentIndex) {
                  return false;
                }
                const level = candidate.type === 'title' ? 1 : candidate.type === 'subtitle' ? 2 : 3;
                const currentLevel = line.type === 'title' ? 1 : 2;
                return level > currentLevel;
              })}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t px-4 py-2 text-right text-xs">
        {renderSaveStatus()}
      </div>
    </div>
  );
}
