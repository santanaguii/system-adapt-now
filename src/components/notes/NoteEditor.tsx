import { useState, useEffect, useRef, useCallback } from 'react';
import { DailyNote, NoteLine, LineType } from '@/types';
import { NoteLine as NoteLineComponent } from './NoteLine';
import { NotesList } from './NotesList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Undo2, Redo2, Loader2, Check, AlertCircle, Save, MessageSquare, MessageSquareOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SaveStatus } from '@/hooks/useNotes';
interface NoteEditorProps {
  currentDate: Date;
  note: DailyNote;
  onDateChange: (date: Date) => void;
  onUpdateLine: (lineId: string, updates: Partial<NoteLine>) => void;
  onAddLine: (afterLineId?: string, type?: LineType) => string;
  onDeleteLine: (lineId: string) => void;
  onToggleCollapse: (lineId: string) => void;
  onUpdateIndent: (lineId: string, delta: number) => void;
  onSearch: (query: string) => DailyNote[];
  allDatesWithNotes: string[];
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  autosaveEnabled: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  onSearch,
  allDatesWithNotes,
  saveStatus,
  hasUnsavedChanges,
  autosaveEnabled,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}: NoteEditorProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DailyNote[]>([]);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  const [showNotesList, setShowNotesList] = useState(false);
  const [highlightTerms, setHighlightTerms] = useState<string[]>([]);
  const [hideComments, setHideComments] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = onSearch(searchQuery);
      setSearchResults(results);
      setHighlightTerms(searchQuery.trim().split(/\s+/));
    } else {
      setSearchResults([]);
      setHighlightTerms([]);
    }
  }, [searchQuery, onSearch]);

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onUndo, onRedo]);
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

  // Calculate visible lines based on collapse state
  const getVisibleLines = useCallback(() => {
    const lines = note.lines;
    const visibleLines: NoteLine[] = [];
    let skipUntilLevel: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLevel = line.type === 'title' ? 1 : line.type === 'subtitle' ? 2 : 3;

      // If hiding comments, skip comment lines
      if (hideComments && line.type === 'comment') {
        continue;
      }

      // If we're skipping, check if we should stop
      if (skipUntilLevel !== null) {
        if (lineLevel <= skipUntilLevel) {
          skipUntilLevel = null;
        } else {
          continue;
        }
      }
      visibleLines.push(line);

      // If this line is collapsed, skip children
      if (line.collapsed && (line.type === 'title' || line.type === 'subtitle')) {
        skipUntilLevel = lineLevel;
      }
    }
    return visibleLines;
  }, [note.lines, hideComments]);
  const visibleLines = getVisibleLines();
  const handleKeyDown = useCallback((lineId: string, e: React.KeyboardEvent) => {
    const allLines = note.lines;
    const lineIndex = allLines.findIndex(l => l.id === lineId);
    const line = allLines[lineIndex];
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newLineId = onAddLine(lineId, 'paragraph');
      setTimeout(() => setFocusedLineId(newLineId), 0);
    } else if (e.key === 'Backspace' && line.content === '' && allLines.length > 1) {
      e.preventDefault();
      const visibleIndex = visibleLines.findIndex(l => l.id === lineId);
      const prevVisibleLine = visibleLines[visibleIndex - 1];
      if (prevVisibleLine) {
        setFocusedLineId(prevVisibleLine.id);
      }
      onDeleteLine(lineId);
    } else if (e.key === 'ArrowUp') {
      const visibleIndex = visibleLines.findIndex(l => l.id === lineId);
      if (visibleIndex > 0) {
        setFocusedLineId(visibleLines[visibleIndex - 1].id);
      }
    } else if (e.key === 'ArrowDown') {
      const visibleIndex = visibleLines.findIndex(l => l.id === lineId);
      if (visibleIndex < visibleLines.length - 1) {
        setFocusedLineId(visibleLines[visibleIndex + 1].id);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onUpdateIndent(lineId, -1);
      } else {
        onUpdateIndent(lineId, 1);
      }
    }

    // Line type shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '1':
          e.preventDefault();
          onUpdateLine(lineId, {
            type: 'title'
          });
          break;
        case '2':
          e.preventDefault();
          onUpdateLine(lineId, {
            type: 'subtitle'
          });
          break;
        case '3':
          e.preventDefault();
          onUpdateLine(lineId, {
            type: 'quote'
          });
          break;
        case '4':
          e.preventDefault();
          onUpdateLine(lineId, {
            type: 'bullet'
          });
          break;
        case '0':
          e.preventDefault();
          onUpdateLine(lineId, {
            type: 'paragraph'
          });
          break;
      }
    }
  }, [note.lines, visibleLines, onAddLine, onDeleteLine, onUpdateLine, onUpdateIndent]);
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const renderSaveStatus = () => {
    if (!autosaveEnabled) {
      if (saveStatus === 'saving') {
        return <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Salvando...
          </span>;
      }
      if (saveStatus === 'saved') {
        return <span className="flex items-center gap-1 text-green-600">
            <Check className="h-3 w-3" />
            Salvo
          </span>;
      }
      if (saveStatus === 'error') {
        return <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" />
            Erro ao salvar
          </span>;
      }
      if (hasUnsavedChanges) {
        return <span className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400">● Alterações não salvas</span>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={onSave}>
              <Save className="h-3 w-3 mr-1" />
              Salvar (Ctrl+S)
            </Button>
          </span>;
      }
      return <span className="text-muted-foreground">Salvamento manual</span>;
    }

    switch (saveStatus) {
      case 'saving':
        return <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Salvando...
          </span>;
      case 'saved':
        return <span className="flex items-center gap-1 text-green-600">
            <Check className="h-3 w-3" />
            Salvo
          </span>;
      case 'error':
        return <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" />
            Erro ao salvar
          </span>;
      default:
        return <span className="text-muted-foreground">Salvo automaticamente</span>;
    }
  };
  return <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={cn('h-8 px-3 font-medium', isToday && 'text-primary')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(currentDate, "d 'de' MMMM, yyyy", {
                locale: ptBR
              })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={currentDate} onSelect={date => date && onDateChange(date)} locale={ptBR} />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {isToday && <span className="text-xs text-primary font-medium px-2 py-0.5 bg-primary/10 rounded-full">
              Hoje
            </span>}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Y)">
            <Redo2 className="h-4 w-4" />
          </Button>
          {!autosaveEnabled && (
            <Button 
              variant={hasUnsavedChanges ? "default" : "ghost"} 
              size="sm" 
              className="h-8 px-3" 
              onClick={onSave}
              disabled={!hasUnsavedChanges}
              title="Salvar (Ctrl+S)"
            >
              <Save className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Notes list sidebar */}
      {showNotesList && <NotesList dates={allDatesWithNotes} currentDate={format(currentDate, 'yyyy-MM-dd')} onSelectDate={date => {
      // Parse date string to local Date (avoiding UTC interpretation)
      const [year, month, day] = date.split('-').map(Number);
      onDateChange(new Date(year, month - 1, day));
      setShowNotesList(false);
    }} onClose={() => setShowNotesList(false)} />}

      {/* Search bar */}
      {isSearching && <div className="px-4 py-2 border-b">
          <Input placeholder="Pesquisar nas notas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8" autoFocus />
          {searchResults.length > 0 && <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map(result => {
                // Parse date string to local Date (avoiding UTC interpretation)
                const [year, month, day] = result.date.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return (
                  <button key={result.date} className="w-full text-left px-2 py-1 rounded hover:bg-muted text-sm" onClick={() => {
                    onDateChange(localDate);
                    setIsSearching(false);
                  }}>
                    <span className="font-medium">
                      {format(localDate, "d 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {result.lines[0]?.content.substring(0, 50)}...
                    </span>
                  </button>
                );
              })}
            </div>}
        </div>}

      {/* Keyboard shortcuts hint */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b flex gap-4 flex-wrap">
        <span>Ctrl+1: Título</span>
        <span>Ctrl+2: Subtítulo</span>
        <span>Ctrl+3: Citação</span>
        <span>Ctrl+4: Tópico</span>
        <span>Ctrl+0: Parágrafo</span>
        <span>Tab/Shift+Tab: Indentação</span>
      </div>

      {/* Editor content */}
      <div ref={editorRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-1">
          {visibleLines.map(line => <NoteLineComponent key={line.id} line={line} isFocused={focusedLineId === line.id} onUpdate={updates => onUpdateLine(line.id, updates)} onKeyDown={e => handleKeyDown(line.id, e)} onFocus={() => setFocusedLineId(line.id)} onToggleCollapse={() => onToggleCollapse(line.id)} highlightTerms={highlightTerms} hasChildren={(line.type === 'title' || line.type === 'subtitle') && note.lines.some((l, i) => {
          const lineIndex = note.lines.findIndex(nl => nl.id === line.id);
          if (i <= lineIndex) return false;
          const level = l.type === 'title' ? 1 : l.type === 'subtitle' ? 2 : 3;
          const currentLevel = line.type === 'title' ? 1 : 2;
          return level > currentLevel;
        })} />)}
        </div>
      </div>

      {/* Autosave indicator */}
      <div className="px-4 py-2 border-t text-xs text-right">
        {renderSaveStatus()}
      </div>
    </div>;
}