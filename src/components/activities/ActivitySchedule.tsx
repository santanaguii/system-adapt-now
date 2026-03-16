import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, CheckCheck, Clock3, GripVertical, Lock, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAuthContext } from '@/contexts/AuthContext';
import { formatDateKey } from '@/lib/date';
import { toast } from '@/components/ui/sonner';
import { Activity } from '@/types';
import {
  ActivityScheduleEntry,
  WORK_PERIODS,
  WORK_SLOT_MINUTES,
  WORK_SLOT_STARTS,
  WORKDAY_TOTAL_MINUTES,
  addWorkingMinutes,
  formatScheduleTime,
  getScheduleDurationOptions,
  getScheduleEntryEndMinute,
  getScheduleEntrySegments,
  getScheduleStartOptions,
  getWorkMinutesBefore,
  hasScheduleConflict,
  sortScheduleEntries,
} from '@/lib/activity-schedule';

interface ActivityScheduleProps {
  currentDate: Date;
  activeActivities: Activity[];
  allActivities: Activity[];
  onOpenActivity: (activity: Activity) => void;
  onToggleComplete: (id: string) => void;
}

const TIMELINE_GAP_PX = 28;
const TIMELINE_BOTTOM_PADDING_PX = 24;
const PX_PER_MINUTE = 1.8;
const DEFAULT_DURATION_MINUTES = '60';
const BLOCK_ACTIONS_WIDTH = 92;
const BLOCK_HEADER_OFFSET = 30;
const RESIZE_HANDLE_HEIGHT = 16;

interface InteractionState {
  mode: 'move' | 'resize';
  entryId: string;
  initialStartMinute: number;
  initialDuration: number;
  candidateValues: number[];
}

function getStorageKey(userId: string) {
  return `activity-schedule:${userId}`;
}

function getEntryHue(id: string) {
  return Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
}

function getScheduleColorKey(entry: ActivityScheduleEntry) {
  return entry.isLocked ? `lock:${entry.lockLabel || 'trava'}` : entry.activityId;
}

function readSchedules(userId: string) {
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) as Record<string, ActivityScheduleEntry[]> : {};
  } catch (error) {
    console.error('Error reading activity schedule:', error);
    return {};
  }
}

function getVisualTop(minute: number) {
  const base = getWorkMinutesBefore(minute) * PX_PER_MINUTE;
  return minute >= WORK_PERIODS[1].start ? base + TIMELINE_GAP_PX : base;
}

function getTimelineMarkers() {
  const markers: number[] = [];

  WORK_PERIODS.forEach((period) => {
    for (let minute = period.start; minute <= period.end; minute += 30) {
      markers.push(minute);
    }
  });

  return markers;
}

function getEntryRangeLabel(entry: ActivityScheduleEntry) {
  if (entry.isAllDay || entry.startMinute === null || entry.durationMinutes === null) {
    return 'Dia todo';
  }

  const endMinute = getScheduleEntryEndMinute(entry);
  if (endMinute === null) {
    return formatScheduleTime(entry.startMinute);
  }

  return `${formatScheduleTime(entry.startMinute)} - ${formatScheduleTime(endMinute)}`;
}

function getNearestStartMinuteFromOffset(offsetY: number) {
  return WORK_SLOT_STARTS.reduce((closest, minute) => {
    const currentDistance = Math.abs(getVisualTop(minute) - offsetY);
    const closestDistance = Math.abs(getVisualTop(closest) - offsetY);
    return currentDistance < closestDistance ? minute : closest;
  }, WORK_SLOT_STARTS[0]);
}

export function ActivitySchedule({
  currentDate,
  activeActivities,
  allActivities,
  onOpenActivity,
  onToggleComplete,
}: ActivityScheduleProps) {
  const { user } = useAuthContext();
  const dateKey = formatDateKey(currentDate);
  const [entriesByDate, setEntriesByDate] = useState<Record<string, ActivityScheduleEntry[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draftIsLocked, setDraftIsLocked] = useState(false);
  const [draftLockLabel, setDraftLockLabel] = useState('');
  const [draftActivityId, setDraftActivityId] = useState('');
  const [draftDuration, setDraftDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [draftStart, setDraftStart] = useState(String(WORK_PERIODS[0].start));
  const [previewEntries, setPreviewEntries] = useState<Record<string, Partial<ActivityScheduleEntry>>>({});
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const pointerMovedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setEntriesByDate({});
      return;
    }

    setEntriesByDate(readSchedules(user.id));
  }, [user]);

  const persistEntries = useCallback((updater: (prev: Record<string, ActivityScheduleEntry[]>) => Record<string, ActivityScheduleEntry[]>) => {
    if (!user) {
      return;
    }

    setEntriesByDate((prev) => {
      const next = updater(prev);

      try {
        window.localStorage.setItem(getStorageKey(user.id), JSON.stringify(next));
      } catch (error) {
        console.error('Error writing activity schedule:', error);
      }

      return next;
    });
  }, [user]);

  const entries = useMemo(
    () => sortScheduleEntries((entriesByDate[dateKey] ?? []).filter((entry) => !entry.isAllDay)),
    [dateKey, entriesByDate]
  );

  const timedEntries = entries;
  const timelineMarkers = useMemo(() => getTimelineMarkers(), []);
  const timelineContentHeight = WORKDAY_TOTAL_MINUTES * PX_PER_MINUTE + TIMELINE_GAP_PX;
  const timelineHeight = timelineContentHeight + TIMELINE_BOTTOM_PADDING_PX;
  const activityMap = useMemo(
    () => new Map(allActivities.map((activity) => [activity.id, activity])),
    [allActivities]
  );
  const schedulableActivities = useMemo(() => {
    const unique = new Map<string, Activity>();
    activeActivities.forEach((activity) => {
      unique.set(activity.id, activity);
    });
    allActivities.forEach((activity) => {
      unique.set(activity.id, activity);
    });
    return Array.from(unique.values());
  }, [activeActivities, allActivities]);

  const resetDialog = useCallback(() => {
    setEditingEntryId(null);
    setDraftIsLocked(false);
    setDraftLockLabel('');
    setDraftActivityId('');
    setDraftDuration(DEFAULT_DURATION_MINUTES);
    setDraftStart(String(WORK_PERIODS[0].start));
  }, []);

  const saveEntries = useCallback((nextEntries: ActivityScheduleEntry[]) => {
    persistEntries((prev) => ({
      ...prev,
      [dateKey]: sortScheduleEntries(nextEntries),
    }));
  }, [dateKey, persistEntries]);

  const getRenderedEntry = useCallback((entry: ActivityScheduleEntry) => {
    const previewPatch = previewEntries[entry.id];
    if (!previewPatch) {
      return entry;
    }

    return {
      ...entry,
      ...previewPatch,
    };
  }, [previewEntries]);

  const openCreateDialog = useCallback((startMinute: number | null) => {
    setEditingEntryId(null);
    setDraftIsLocked(false);
    setDraftLockLabel('');
    setDraftActivityId('');
    setDraftDuration(DEFAULT_DURATION_MINUTES);
    setDraftStart(String(startMinute ?? WORK_PERIODS[0].start));
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((entry: ActivityScheduleEntry) => {
    setEditingEntryId(entry.id);
    setDraftIsLocked(entry.isLocked === true);
    setDraftLockLabel(entry.lockLabel || '');
    setDraftActivityId(entry.activityId);
    setDraftDuration(String(entry.durationMinutes ?? DEFAULT_DURATION_MINUTES));
    setDraftStart(String(entry.startMinute ?? WORK_PERIODS[0].start));
    setDialogOpen(true);
  }, []);

  const openEntryPreview = useCallback((entry: ActivityScheduleEntry) => {
    if (entry.isLocked) {
      openEditDialog(entry);
      return;
    }

    const activity = activityMap.get(entry.activityId);
    if (!activity) {
      openEditDialog(entry);
      return;
    }

    onOpenActivity(activity);
  }, [activityMap, onOpenActivity, openEditDialog]);

  const handleDeleteEntry = useCallback((entryId: string) => {
    saveEntries(entries.filter((entry) => entry.id !== entryId));
    setDialogOpen(false);
    resetDialog();
    setPreviewEntries((prev) => {
      if (!(entryId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }, [entries, resetDialog, saveEntries]);

  const handleSaveDraft = useCallback(() => {
    if (!draftIsLocked && !draftActivityId) {
      toast.error('Selecione uma atividade.');
      return;
    }

    if (draftIsLocked && !draftLockLabel.trim()) {
      toast.error('Informe o nome da trava.');
      return;
    }

    const existingEntry = editingEntryId
      ? entries.find((entry) => entry.id === editingEntryId) ?? null
      : null;

    const baseEntry = existingEntry ?? {
      id: crypto.randomUUID(),
      activityId: draftActivityId,
      date: dateKey,
      startMinute: null,
      durationMinutes: null,
      isAllDay: false,
      isLocked: false,
      lockLabel: null,
      createdAt: new Date().toISOString(),
    } satisfies ActivityScheduleEntry;

    const nextEntry: ActivityScheduleEntry = {
      ...baseEntry,
      activityId: draftIsLocked ? '' : draftActivityId,
      date: dateKey,
      isLocked: draftIsLocked,
      lockLabel: draftIsLocked ? draftLockLabel.trim() : null,
    };

    const startMinute = Number(draftStart);
    const durationMinutes = Number(draftDuration);

    if (Number.isNaN(startMinute) || Number.isNaN(durationMinutes)) {
      toast.error('Horario ou duracao invalidos.');
      return;
    }

    if (addWorkingMinutes(startMinute, durationMinutes) === null) {
      toast.error('Esse bloco nao cabe no expediente.');
      return;
    }

    nextEntry.isAllDay = false;
    nextEntry.startMinute = startMinute;
    nextEntry.durationMinutes = durationMinutes;

    const otherEntries = editingEntryId
      ? entries.filter((entry) => entry.id !== editingEntryId)
      : entries;

    if (hasScheduleConflict(nextEntry, otherEntries)) {
      toast.error('Esse horario conflita com outro bloco do cronograma.');
      return;
    }

    const nextEntries = editingEntryId
      ? entries.map((entry) => entry.id === editingEntryId ? nextEntry : entry)
      : [...entries, nextEntry];

    saveEntries(nextEntries);
    setDialogOpen(false);
    resetDialog();
  }, [dateKey, draftActivityId, draftDuration, draftIsLocked, draftLockLabel, draftStart, editingEntryId, entries, resetDialog, saveEntries]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetDialog();
    }
  }, [resetDialog]);

  useEffect(() => {
    if (!interactionState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const timeline = timelineRef.current;
      if (!timeline) {
        return;
      }

      const rect = timeline.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(event.clientY - rect.top, timelineContentHeight));

      pointerMovedRef.current = true;

      if (interactionState.mode === 'resize') {
        const nearestDuration = interactionState.candidateValues.reduce((closest, duration) => {
          const endMinute = addWorkingMinutes(interactionState.initialStartMinute, duration);
          if (endMinute === null) {
            return closest;
          }

          const currentDistance = Math.abs(getVisualTop(endMinute) - relativeY);
          const closestEndMinute = addWorkingMinutes(interactionState.initialStartMinute, closest);
          const closestDistance = closestEndMinute === null ? Number.POSITIVE_INFINITY : Math.abs(getVisualTop(closestEndMinute) - relativeY);

          return currentDistance < closestDistance ? duration : closest;
        }, interactionState.initialDuration);

        setPreviewEntries((prev) => ({
          ...prev,
          [interactionState.entryId]: {
            durationMinutes: nearestDuration,
          },
        }));
        return;
      }

      const nearestStart = interactionState.candidateValues.reduce((closest, startMinute) => {
        const currentDistance = Math.abs(getVisualTop(startMinute) - relativeY);
        const closestDistance = Math.abs(getVisualTop(closest) - relativeY);
        return currentDistance < closestDistance ? startMinute : closest;
      }, interactionState.initialStartMinute);

      setPreviewEntries((prev) => ({
        ...prev,
        [interactionState.entryId]: {
          startMinute: nearestStart,
        },
      }));
    };

    const handlePointerUp = () => {
      const currentEntry = entries.find((entry) => entry.id === interactionState.entryId);

      if (currentEntry) {
        const previewPatch = previewEntries[interactionState.entryId] ?? {};
        const nextEntry: ActivityScheduleEntry = {
          ...currentEntry,
          ...previewPatch,
        };

        if (!pointerMovedRef.current) {
          openEntryPreview(currentEntry);
        } else {
          const otherEntries = entries.filter((entry) => entry.id !== currentEntry.id);
          if (hasScheduleConflict(nextEntry, otherEntries)) {
            toast.error(
              interactionState.mode === 'resize'
                ? 'Esse redimensionamento conflita com outro bloco do cronograma.'
                : 'Esse movimento conflita com outro bloco do cronograma.'
            );
          } else {
            saveEntries(entries.map((entry) => entry.id === currentEntry.id ? nextEntry : entry));
          }
        }
      }

      setPreviewEntries((prev) => {
        if (!(interactionState.entryId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[interactionState.entryId];
        return next;
      });
      pointerMovedRef.current = false;
      setInteractionState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [entries, interactionState, openEntryPreview, previewEntries, saveEntries, timelineContentHeight]);

  const handleStartResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, entry: ActivityScheduleEntry) => {
    event.preventDefault();
    event.stopPropagation();

    if (entry.startMinute === null || entry.durationMinutes === null) {
      return;
    }

    const candidateDurations: number[] = [];
    for (let duration = WORK_SLOT_MINUTES; duration <= WORKDAY_TOTAL_MINUTES; duration += WORK_SLOT_MINUTES) {
      if (addWorkingMinutes(entry.startMinute, duration) !== null) {
        candidateDurations.push(duration);
      }
    }

    pointerMovedRef.current = false;
    setPreviewEntries((prev) => ({
      ...prev,
      [entry.id]: {
        durationMinutes: entry.durationMinutes ?? WORK_SLOT_MINUTES,
      },
    }));
    setInteractionState({
      mode: 'resize',
      entryId: entry.id,
      candidateValues: candidateDurations,
      initialStartMinute: entry.startMinute,
      initialDuration: entry.durationMinutes,
    });
  }, []);

  const handleStartMove = useCallback((event: ReactPointerEvent<HTMLDivElement>, entry: ActivityScheduleEntry) => {
    if ((event.target as HTMLElement).closest('[data-schedule-action="delete"], [data-schedule-action="resize"], [data-schedule-action="complete"], [data-schedule-action="edit"]')) {
      return;
    }

    event.preventDefault();

    if (entry.startMinute === null || entry.durationMinutes === null) {
      openEntryPreview(entry);
      return;
    }

    const candidateStarts = WORK_SLOT_STARTS.filter((startMinute) => {
      const testEntry: ActivityScheduleEntry = {
        ...entry,
        startMinute,
      };

      if (addWorkingMinutes(startMinute, entry.durationMinutes ?? WORK_SLOT_MINUTES) === null) {
        return false;
      }

      return !hasScheduleConflict(testEntry, entries.filter((item) => item.id !== entry.id));
    });

    if (candidateStarts.length === 0) {
      openEntryPreview(entry);
      return;
    }

    pointerMovedRef.current = false;
    setPreviewEntries((prev) => ({
      ...prev,
      [entry.id]: {
        startMinute: entry.startMinute ?? WORK_PERIODS[0].start,
      },
    }));
    setInteractionState({
      mode: 'move',
      entryId: entry.id,
      candidateValues: candidateStarts,
      initialStartMinute: entry.startMinute,
      initialDuration: entry.durationMinutes,
    });
  }, [entries, openEntryPreview]);

  const handleTimelineBackgroundClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const nearestStartMinute = getNearestStartMinuteFromOffset(offsetY);
    openCreateDialog(nearestStartMinute);
  }, [openCreateDialog]);

  return (
    <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">
            Cronograma de {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="text-xs text-muted-foreground">
            Clique em um espaco vazio do calendario para criar um bloco.
          </div>
        </div>
        <Badge variant="secondary" className="gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {entries.length} bloco{entries.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="min-h-0 rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-medium">Agenda do dia</div>
          <div className="text-xs text-muted-foreground">08:30-12:00 e 13:30-18:00</div>
        </div>

        <ScrollArea className="h-[640px]">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] px-3 py-3">
            <div className="relative" style={{ height: timelineHeight }}>
              {timelineMarkers.map((minute) => (
                <div
                  key={minute}
                  className="absolute right-3 -translate-y-1/2 text-[11px] text-muted-foreground"
                  style={{ top: getVisualTop(minute) }}
                >
                  {formatScheduleTime(minute)}
                </div>
              ))}
            </div>

            <div
              ref={timelineRef}
              onClick={handleTimelineBackgroundClick}
              className="relative rounded-xl border bg-muted/20"
              style={{ height: timelineHeight }}
            >

              {timelineMarkers.map((minute) => (
                <div
                  key={minute}
                  className="pointer-events-none absolute inset-x-0 z-[2] border-t border-dashed border-border/70"
                  style={{ top: getVisualTop(minute) }}
                />
              ))}

              <div
                className="pointer-events-none absolute inset-x-0 z-[2] flex items-center justify-center border-y bg-background/85 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                style={{ top: getVisualTop(WORK_PERIODS[0].end), height: TIMELINE_GAP_PX }}
              >
                Intervalo
              </div>

              {timedEntries.map((entry) => {
                const renderedEntry = getRenderedEntry(entry);
                const activity = activityMap.get(renderedEntry.activityId);
                const title = renderedEntry.isLocked ? (renderedEntry.lockLabel || 'Trava') : (activity?.title ?? 'Atividade indisponivel');
                const hue = getEntryHue(getScheduleColorKey(renderedEntry));
                const segments = getScheduleEntrySegments(renderedEntry);
                const isCompleted = activity?.completed === true;

                return segments.map((segment, index) => {
                  const top = getVisualTop(segment.startMinute);
                  const height = (segment.endMinute - segment.startMinute) * PX_PER_MINUTE;
                  const hasActions = index === 0;
                  const hasResizeHandle = index === segments.length - 1;
                  const isCompactBlock = height < 54;
                  const showFullLabel = !isCompactBlock;
                  const showRangeLabel = height >= (hasResizeHandle ? 62 : 42);
                  const showCompactTime = height >= 20;
                  const showHeaderActions = hasActions && height >= 62;
                  const compactActionsWidth = 56;
                  const resizeHandleHeight = hasResizeHandle ? (height < 34 ? 8 : RESIZE_HANDLE_HEIGHT) : 0;
                  const contentPaddingTop = showHeaderActions ? BLOCK_HEADER_OFFSET : 0;
                  const contentPaddingRight = hasActions ? (showHeaderActions ? BLOCK_ACTIONS_WIDTH : compactActionsWidth) : 0;
                  const contentPaddingBottom = height >= 26 ? resizeHandleHeight + 4 : 0;
                  const actionButtonClassName = isCompactBlock
                    ? 'rounded-md bg-white/90 p-0.5 opacity-90 shadow-sm transition-opacity hover:bg-white hover:opacity-100'
                    : 'rounded-md bg-white/85 p-1 opacity-85 shadow-sm transition-opacity hover:bg-white hover:opacity-100';
                  const actionIconClassName = isCompactBlock ? 'h-3 w-3' : 'h-3.5 w-3.5';

                  return (
                    <div
                      key={`${entry.id}:${segment.startMinute}`}
                      onPointerDown={(event) => handleStartMove(event, entry)}
                      className="group absolute left-2 right-2 z-[5] overflow-hidden rounded-lg border px-3 py-2 text-left shadow-sm transition-transform hover:scale-[1.01] touch-none"
                      style={{
                        top,
                        height,
                        borderColor: `hsl(${hue} 55% 46%)`,
                        backgroundColor: `hsl(${hue} 90% 95%)`,
                        color: `hsl(${hue} 45% 22%)`,
                        opacity: isCompleted ? 0.7 : 1,
                      }}
                    >
                      {hasActions && (
                        <div className={`absolute right-2 z-[6] flex items-center gap-1 ${showHeaderActions ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
                          {!renderedEntry.isLocked && activity && !activity.completed && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleComplete(activity.id);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              data-schedule-action="complete"
                              className={actionButtonClassName}
                              aria-label="Concluir atividade"
                              title="Marcar como concluida"
                            >
                              <CheckCheck className={actionIconClassName} />
                            </button>
                          )}
                          {!renderedEntry.isLocked && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditDialog(entry);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              data-schedule-action="edit"
                              className={actionButtonClassName}
                              aria-label="Editar bloco"
                              title="Editar bloco"
                            >
                              <Pencil className={actionIconClassName} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            data-schedule-action="delete"
                            className={actionButtonClassName}
                            aria-label="Excluir bloco"
                          >
                            <Trash2 className={actionIconClassName} />
                          </button>
                        </div>
                      )}

                      {showFullLabel ? (
                        <div
                          className="flex h-full min-h-0 flex-col"
                          style={{
                            paddingTop: contentPaddingTop,
                            paddingRight: contentPaddingRight,
                            paddingBottom: contentPaddingBottom,
                          }}
                        >
                          <div className="truncate text-sm font-medium flex items-center gap-1.5">
                            {renderedEntry.isLocked && <Lock className="h-3.5 w-3.5 shrink-0" />}
                            <span className={isCompleted ? 'truncate line-through' : 'truncate'}>{title}</span>
                          </div>
                          {showRangeLabel && (
                            <div className="mt-auto text-[11px] opacity-80">
                              {index === 0 ? getEntryRangeLabel(renderedEntry) : `${formatScheduleTime(segment.startMinute)} continua`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="flex h-full min-h-0 items-center"
                          style={{
                            paddingTop: contentPaddingTop,
                            paddingRight: contentPaddingRight,
                            paddingBottom: contentPaddingBottom,
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium leading-none">
                            {renderedEntry.isLocked && <Lock className="h-3 w-3 shrink-0" />}
                            <span className={isCompleted ? 'truncate line-through' : 'truncate'}>{title}</span>
                            {showCompactTime && (
                              <span className="shrink-0 text-[9px] opacity-70">
                                {index === 0 ? formatScheduleTime(renderedEntry.startMinute ?? segment.startMinute) : formatScheduleTime(segment.startMinute)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {hasResizeHandle && (
                        <div
                          onPointerDown={(event) => handleStartResize(event, entry)}
                          onClick={(event) => event.stopPropagation()}
                          data-schedule-action="resize"
                          className="absolute inset-x-0 bottom-0 z-[7] flex cursor-ns-resize items-center justify-center border-t border-black/15 bg-white/45 backdrop-blur-[1px] transition-colors hover:bg-white/65"
                          aria-label="Redimensionar bloco no calendario"
                          role="separator"
                          title="Arraste para redimensionar"
                          style={{ height: resizeHandleHeight }}
                        >
                          <div className="flex items-center justify-center rounded-full bg-black/10 px-2 py-0.5">
                            <GripVertical className="h-3.5 w-3.5 rotate-90 opacity-70" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })}

              {timedEntries.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  Nenhum bloco com horario ainda. Clique em um espaco vazio para planejar.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntryId ? 'Editar bloco do cronograma' : 'Novo bloco do cronograma'}</DialogTitle>
            <DialogDescription>
              Defina a atividade, a duracao e o horario deste bloco visual do dia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Trava de agenda</div>
                <div className="text-xs text-muted-foreground">Use para bloquear horario de reuniao ou compromisso</div>
              </div>
              <Switch checked={draftIsLocked} onCheckedChange={setDraftIsLocked} />
            </div>

            {draftIsLocked ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome da trava</label>
                <Input
                  value={draftLockLabel}
                  onChange={(event) => setDraftLockLabel(event.target.value)}
                  placeholder="Ex.: Reuniao com cliente"
                />
              </div>
            ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Atividade</label>
              <Select value={draftActivityId || undefined} onValueChange={setDraftActivityId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma atividade" />
                </SelectTrigger>
                <SelectContent>
                  {schedulableActivities.map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Duracao</label>
              <Select value={draftDuration} onValueChange={setDraftDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getScheduleDurationOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Inicio</label>
              <Select value={draftStart} onValueChange={setDraftStart}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getScheduleStartOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                {`Inicio previsto: ${formatScheduleTime(Number(draftStart))}`}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              {editingEntryId && (
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteEntry(editingEntryId)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveDraft}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
