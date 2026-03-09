import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { DailyNote, NoteLine, LineType, NoteSearchResult } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cloneNotesSnapshot, upsertNoteSnapshot } from './useNotes.utils';

const generateId = () => crypto.randomUUID();

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface HistoryState {
  notes: DailyNote[];
  timestamp: number;
}

// Type definitions for external Supabase tables
interface NoteRow {
  id: string;
  user_id: string;
  date: string;
  updated_at: string;
}

interface NoteLineRow {
  id: string;
  note_id: string;
  content: string;
  line_type: string;
  indent: number;
  collapsed: boolean;
  sort_order: number;
}

export function useNotes(autosaveEnabled: boolean = true) {
  const { user, isAuthenticated } = useAuthContext();
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [persistedNotes, setPersistedNotes] = useState<DailyNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSavesRef = useRef<Map<string, DailyNote>>(new Map());
  
  // Undo/Redo history (local only)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const skipHistoryRef = useRef(false);

  const resetHistory = useCallback((snapshot: DailyNote[]) => {
    const clonedSnapshot = cloneNotesSnapshot(snapshot);
    const nextHistory = [{ notes: clonedSnapshot, timestamp: Date.now() }];
    historyIndexRef.current = 0;
    setHistory(nextHistory);
    setHistoryIndex(0);
  }, []);

  // Load notes from database
  useEffect(() => {
    if (!isAuthenticated || !user) {
      skipHistoryRef.current = true;
      setNotes([]);
      setPersistedNotes([]);
      pendingSavesRef.current.clear();
      setHasUnsavedChanges(false);
      setSaveStatus('idle');
      resetHistory([]);
      setIsLoading(false);
      return;
    }

    const loadNotes = async () => {
      setIsLoading(true);
      try {
        // Load all notes for this user
        const { data: notesData, error: notesError } = await supabase
          .from('notes' as never)
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false }) as { data: NoteRow[] | null; error: unknown };

        if (notesError || !notesData) {
          console.error('Error loading notes:', notesError);
          setIsLoading(false);
          return;
        }

        // Load all note lines for these notes
        const noteIds = notesData.map(n => n.id);
        
        if (noteIds.length === 0) {
          skipHistoryRef.current = true;
          setNotes([]);
          setPersistedNotes([]);
          pendingSavesRef.current.clear();
          setHasUnsavedChanges(false);
          setSaveStatus('idle');
          resetHistory([]);
          setIsLoading(false);
          return;
        }

        const { data: linesData, error: linesError } = await supabase
          .from('note_lines' as never)
          .select('*')
          .in('note_id', noteIds)
          .order('sort_order') as { data: NoteLineRow[] | null; error: unknown };

        if (linesError) {
          console.error('Error loading note lines:', linesError);
          setIsLoading(false);
          return;
        }

        // Group lines by note
        const linesByNote = new Map<string, NoteLineRow[]>();
        (linesData || []).forEach(line => {
          const existing = linesByNote.get(line.note_id) || [];
          existing.push(line);
          linesByNote.set(line.note_id, existing);
        });

        // Convert to DailyNote format
        const loadedNotes: DailyNote[] = notesData.map(note => ({
          date: note.date,
          lines: (linesByNote.get(note.id) || []).map(line => ({
            id: line.id,
            content: line.content,
            type: line.line_type as LineType,
            indent: line.indent,
            collapsed: line.collapsed,
          })),
          updatedAt: new Date(note.updated_at),
        }));

        // Ensure each note has at least one line
        loadedNotes.forEach(note => {
          if (note.lines.length === 0) {
            note.lines = [{ id: generateId(), content: '', type: 'paragraph' }];
          }
        });

        const snapshot = cloneNotesSnapshot(loadedNotes);
        skipHistoryRef.current = true;
        setNotes(snapshot);
        setPersistedNotes(snapshot);
        pendingSavesRef.current.clear();
        setHasUnsavedChanges(false);
        setSaveStatus('idle');
        resetHistory(snapshot);
      } catch (error) {
        console.error('Error loading notes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();
  }, [isAuthenticated, user, resetHistory]);

  // Track notes changes for history
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    if (historyIndexRef.current < 0) {
      return;
    }

    const newState: HistoryState = { notes: cloneNotesSnapshot(notes), timestamp: Date.now() };
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndexRef.current + 1);
      newHistory.push(newState);
      // Keep only last 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      historyIndexRef.current = newHistory.length - 1;
      setHistoryIndex(historyIndexRef.current);
      return newHistory;
    });
  }, [notes]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      isUndoRedoRef.current = true;
      const prevIndex = historyIndexRef.current - 1;
      const prevState = history[prevIndex];
      setNotes(prevState.notes);
      historyIndexRef.current = prevIndex;
      setHistoryIndex(prevIndex);
    }
  }, [history]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextIndex = historyIndexRef.current + 1;
      const nextState = history[nextIndex];
      setNotes(nextState.notes);
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
    }
  }, [history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Debounced save to database
  const persistNote = useCallback(async (note: DailyNote) => {
    if (!user) return false;

    try {
      // Upsert the note
      const { data: noteData, error: noteError } = await supabase
        .from('notes' as never)
        .upsert({
          user_id: user.id,
          date: note.date,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: 'user_id,date' })
        .select()
        .single() as { data: NoteRow | null; error: unknown };

      if (noteError || !noteData) {
        console.error('Error saving note:', noteError);
        setSaveStatus('error');
        return false;
      }

      // Delete existing lines and insert new ones
      const { error: deleteError } = await supabase
        .from('note_lines' as never)
        .delete()
        .eq('note_id', noteData.id);

      if (deleteError) {
        console.error('Error deleting note lines:', deleteError);
        setSaveStatus('error');
        return false;
      }

      // Insert new lines
      if (note.lines.length > 0) {
        const linesToInsert = note.lines.map((line, index) => ({
          id: line.id,
          note_id: noteData.id,
          content: line.content,
          line_type: line.type,
          indent: line.indent || 0,
          collapsed: line.collapsed || false,
          sort_order: index,
        }));

        const { error: linesError } = await supabase
          .from('note_lines' as never)
          .insert(linesToInsert as never);

        if (linesError) {
          console.error('Error saving note lines:', linesError);
          setSaveStatus('error');
          return false;
        }
      }

      const persistedNote = {
        ...note,
        updatedAt: new Date(),
      };
      const persistedSnapshot = cloneNotesSnapshot([persistedNote])[0];
      setPersistedNotes((prev) => upsertNoteSnapshot(prev, persistedSnapshot));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return true;
    } catch (error) {
      console.error('Error persisting note:', error);
      setSaveStatus('error');
      return false;
    }
  }, [user]);

  const flushPendingSaves = useCallback(async () => {
    const pendingEntries = Array.from(pendingSavesRef.current.entries());

    if (pendingEntries.length === 0) {
      return true;
    }

    let allSaved = true;

    for (const [dateKey, noteToSave] of pendingEntries) {
      const didSave = await persistNote(noteToSave);
      if (didSave) {
        pendingSavesRef.current.delete(dateKey);
      } else {
        allSaved = false;
      }
    }

    setHasUnsavedChanges(pendingSavesRef.current.size > 0);
    return allSaved;
  }, [persistNote]);

  const triggerSave = useCallback((note: DailyNote) => {
    if (!user) return;

    // Add to pending saves
    pendingSavesRef.current.set(note.date, note);
    setHasUnsavedChanges(true);

    // If autosave is disabled, just mark as having unsaved changes
    if (!autosaveEnabled) {
      setSaveStatus('idle');
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setSaveStatus('saving');
    
    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      await flushPendingSaves();
      saveTimeoutRef.current = null;
    }, 1000);
  }, [user, autosaveEnabled, flushPendingSaves]);

  const getNote = useCallback((date: Date): DailyNote => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const existing = notes.find((n) => n.date === dateKey);
    if (existing) return existing;
    
    return {
      date: dateKey,
      lines: [{ id: generateId(), content: '', type: 'paragraph' }],
      updatedAt: new Date(),
    };
  }, [notes]);

  const saveNote = useCallback((note: DailyNote) => {
    const nextNote = { ...note, updatedAt: new Date() };
    setNotes((prev) => {
      return upsertNoteSnapshot(prev, nextNote);
    });
    triggerSave(nextNote);
  }, [triggerSave]);

  const updateLine = useCallback((date: Date, lineId: string, updates: Partial<NoteLine>) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    setNotes((prev) => {
      const noteIndex = prev.findIndex((n) => n.date === dateKey);
      
      // If note doesn't exist, create it
      if (noteIndex < 0) {
        const newNote: DailyNote = {
          date: dateKey,
          lines: [{ id: lineId, content: '', type: 'paragraph', ...updates }],
          updatedAt: new Date(),
        };
        triggerSave(newNote);
        return [...prev, newNote];
      }
      
      const updated = [...prev];
      const newNote = {
        ...updated[noteIndex],
        lines: updated[noteIndex].lines.map((line) =>
          line.id === lineId ? { ...line, ...updates } : line
        ),
        updatedAt: new Date(),
      };
      updated[noteIndex] = newNote;
      triggerSave(newNote);
      return updated;
    });
  }, [triggerSave]);

  const addLine = useCallback((date: Date, afterLineId?: string, type: LineType = 'paragraph') => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const newLine: NoteLine = { id: generateId(), content: '', type };
    
    setNotes((prev) => {
      const noteIndex = prev.findIndex((n) => n.date === dateKey);
      
      if (noteIndex < 0) {
        const newNote: DailyNote = {
          date: dateKey,
          lines: [newLine],
          updatedAt: new Date(),
        };
        triggerSave(newNote);
        return [...prev, newNote];
      }
      
      const updated = [...prev];
      const lines = [...updated[noteIndex].lines];
      
      if (afterLineId) {
        const afterIndex = lines.findIndex((l) => l.id === afterLineId);
        lines.splice(afterIndex + 1, 0, newLine);
      } else {
        lines.push(newLine);
      }
      
      const newNote = { ...updated[noteIndex], lines, updatedAt: new Date() };
      updated[noteIndex] = newNote;
      triggerSave(newNote);
      return updated;
    });
    
    return newLine.id;
  }, [triggerSave]);

  const deleteLine = useCallback((date: Date, lineId: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    setNotes((prev) => {
      const noteIndex = prev.findIndex((n) => n.date === dateKey);
      if (noteIndex < 0) return prev;
      
      const updated = [...prev];
      let lines = updated[noteIndex].lines.filter((l) => l.id !== lineId);
      
      if (lines.length === 0) {
        lines = [{ id: generateId(), content: '', type: 'paragraph' }];
      }
      
      const newNote = { ...updated[noteIndex], lines, updatedAt: new Date() };
      updated[noteIndex] = newNote;
      triggerSave(newNote);
      return updated;
    });
  }, [triggerSave]);

  const toggleLineCollapsed = useCallback((date: Date, lineId: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    setNotes((prev) => {
      const noteIndex = prev.findIndex((n) => n.date === dateKey);
      if (noteIndex < 0) return prev;
      
      const updated = [...prev];
      const newNote = {
        ...updated[noteIndex],
        lines: updated[noteIndex].lines.map((line) =>
          line.id === lineId ? { ...line, collapsed: !line.collapsed } : line
        ),
        updatedAt: new Date(),
      };
      updated[noteIndex] = newNote;
      triggerSave(newNote);
      return updated;
    });
  }, [triggerSave]);

  const updateLineIndent = useCallback((date: Date, lineId: string, delta: number) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    
    setNotes((prev) => {
      const noteIndex = prev.findIndex((n) => n.date === dateKey);
      if (noteIndex < 0) return prev;
      
      const updated = [...prev];
      const newNote = {
        ...updated[noteIndex],
        lines: updated[noteIndex].lines.map((line) => {
          if (line.id === lineId) {
            const newIndent = Math.max(0, Math.min(4, (line.indent || 0) + delta));
            return { ...line, indent: newIndent };
          }
          return line;
        }),
        updatedAt: new Date(),
      };
      updated[noteIndex] = newNote;
      triggerSave(newNote);
      return updated;
    });
  }, [triggerSave]);

  const searchNotes = useCallback((query: string): NoteSearchResult[] => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const normalizedQuery = trimmedQuery.toLowerCase();
    const terms = [normalizedQuery];

    if (terms.length === 0) {
      return [];
    }

    return notes.flatMap((note) => note.lines.flatMap((line) => {
      const content = line.content;
      const lowerContent = content.toLowerCase();

      if (!lowerContent.trim()) {
        return [];
      }

      const matches: NoteSearchResult[] = [];

      terms.forEach((term) => {
        let searchFrom = 0;

        while (searchFrom <= lowerContent.length) {
          const matchIndex = lowerContent.indexOf(term, searchFrom);
          if (matchIndex === -1) {
            break;
          }

          const snippetStart = Math.max(0, matchIndex - 28);
          const snippetEnd = Math.min(content.length, matchIndex + term.length + 44);
          const rawSnippet = content.slice(snippetStart, snippetEnd).trim();
          const snippet = `${snippetStart > 0 ? '...' : ''}${rawSnippet}${snippetEnd < content.length ? '...' : ''}`;

          matches.push({
            date: note.date,
            matchedLineIds: [line.id],
            matchedTerms: [term],
            snippet,
            primaryLineId: line.id,
            matchStart: matchIndex,
          });

          searchFrom = matchIndex + Math.max(term.length, 1);
        }
      });

      return matches;
    }));
  }, [notes]);

  const allDatesWithNotes = useMemo(() => {
    return notes
      .filter((n) => n.lines.some((l) => l.content.trim() !== ''))
      .map((n) => n.date)
      .sort()
      .reverse();
  }, [notes]);

  // Manual save function
  const saveAllPending = useCallback(async () => {
    if (!user) return;

    const pendingSaves = Array.from(pendingSavesRef.current.values());
    if (pendingSaves.length === 0 && !hasUnsavedChanges) return;

    // Also include current notes that may not be in pending
    const notesToSave = pendingSaves.length > 0 ? pendingSaves : notes.filter(n => n.lines.some(l => l.content.trim() !== ''));
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    pendingSavesRef.current = new Map(notesToSave.map((note) => [note.date, note]));

    await flushPendingSaves();
  }, [user, notes, hasUnsavedChanges, flushPendingSaves]);

  // Discard all pending changes
  const discardChanges = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSavesRef.current.clear();
    skipHistoryRef.current = true;
    const snapshot = cloneNotesSnapshot(persistedNotes);
    setNotes(snapshot);
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
    resetHistory(snapshot);
  }, [persistedNotes, resetHistory]);

  return {
    notes,
    isLoading,
    getNote,
    saveNote,
    updateLine,
    addLine,
    deleteLine,
    toggleLineCollapsed,
    updateLineIndent,
    searchNotes,
    allDatesWithNotes,
    saveStatus,
    hasUnsavedChanges,
    saveAllPending,
    discardChanges,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
