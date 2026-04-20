import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SaveStatus } from '@/hooks/useNotes';
import { Activity, DailyNote, NoteTemplate, Tag } from '@/types';
import { ACTIVITY_META, getBlockedBy, getProjectName, getScheduledDate, shouldShowInToday } from '@/lib/activity-meta';
import { getDateKeyInTimeZone, normalizeDateKey, parseDateKey } from '@/lib/date';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlarmClockCheck,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  CircleDashed,
  Clock3,
  FileWarning,
  ListTodo,
  Plus,
  Sparkles,
} from 'lucide-react';
import { DashboardNoteEditor } from './DashboardNoteEditor';

type DashboardSection = 'dashboard' | 'activities' | 'notes';

interface DashboardOverviewProps {
  currentDate: Date;
  note: DailyNote;
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  autosaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  saveStatus: SaveStatus;
  noteTemplates?: NoteTemplate[];
  onOpenSection: (section: Exclude<DashboardSection, 'dashboard'>) => void;
  onReplaceNoteContent: (date: Date, html: string) => void;
  onCreateActivity: () => void;
  onToggleComplete: (id: string) => void;
  onOpenActivity: (activity: Activity) => void;
  onSaveNote: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

function getRelevantDate(activity: Activity) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
  return dueDate || getScheduledDate(activity);
}

function formatHeaderDate(date: Date) {
  return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
}

function formatDueDateLabel(dateKey: string | null, todayKey: string) {
  if (!dateKey) return 'Sem prazo';
  if (dateKey < todayKey) return `Atrasada ${format(parseDateKey(dateKey), 'dd/MM', { locale: ptBR })}`;
  if (dateKey === todayKey) return 'Hoje';
  return format(parseDateKey(dateKey), 'dd/MM', { locale: ptBR });
}

export function DashboardOverview({
  currentDate,
  note,
  activities,
  tags,
  autosaveEnabled,
  hasUnsavedChanges,
  saveStatus,
  noteTemplates = [],
  onOpenSection,
  onReplaceNoteContent,
  onCreateActivity,
  onToggleComplete,
  onOpenActivity,
  onSaveNote,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: DashboardOverviewProps) {
  const todayKey = getDateKeyInTimeZone(currentDate);
  const allActive = activities.active;

  const overdueActivities = allActive.filter((activity) => {
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    return Boolean(dueDate) && dueDate < todayKey;
  });

  const todayActivities = allActive.filter((activity) => shouldShowInToday(activity, todayKey));
  const waitingActivities = allActive.filter((activity) => Boolean(getBlockedBy(activity)));
  const completedToday = activities.completed.filter((activity) => activity.completedAt ? isSameDay(activity.completedAt, currentDate) : false);

  const highlightedActivities = [...allActive]
    .filter((activity) => shouldShowInToday(activity, todayKey) || overdueActivities.some((item) => item.id === activity.id))
    .sort((left, right) => {
      const leftDate = getRelevantDate(left) ?? '9999-12-31';
      const rightDate = getRelevantDate(right) ?? '9999-12-31';
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }
      return left.order - right.order;
    })
    .slice(0, 6);

  const quickStats = [
    { id: 'today', label: 'Atividades de hoje', value: todayActivities.length, icon: ListTodo, tone: 'bg-primary/10 text-primary' },
    { id: 'overdue', label: 'Pendencias vencidas', value: overdueActivities.length, icon: FileWarning, tone: 'bg-destructive/10 text-destructive' },
    { id: 'waiting', label: 'Em acompanhamento', value: waitingActivities.length, icon: AlarmClockCheck, tone: 'bg-secondary text-secondary-foreground' },
    { id: 'done', label: 'Concluidas hoje', value: completedToday.length, icon: CheckCheck, tone: 'bg-primary/10 text-primary' },
  ];

  const criticalItems = [
    ...overdueActivities.slice(0, 2).map((activity) => ({
      id: `overdue:${activity.id}`,
      title: activity.title,
      context: 'Prazo vencido',
      detail: formatDueDateLabel(getRelevantDate(activity), todayKey),
      tone: 'text-destructive',
    })),
    ...waitingActivities.slice(0, 2).map((activity) => ({
      id: `waiting:${activity.id}`,
      title: activity.title,
      context: 'Dependencia externa',
      detail: getBlockedBy(activity) || 'Aguardando definicao',
      tone: 'text-primary',
    })),
    ...todayActivities
      .filter((activity) => getRelevantDate(activity) === todayKey)
      .slice(0, 2)
      .map((activity) => ({
        id: `today:${activity.id}`,
        title: activity.title,
        context: 'Entrega do dia',
        detail: getProjectName(activity) || 'Sem projeto definido',
        tone: 'text-foreground',
      })),
  ].slice(0, 5);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-[32px] border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatHeaderDate(currentDate)}
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-foreground">Dashboard</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Um painel de abertura do dia para decidir rapido o que pede acao, registrar contexto e manter foco no que realmente precisa andar.
              </p>
            </div>

            <Button className="h-12 rounded-full px-5 text-sm font-medium" onClick={onCreateActivity}>
              <Plus className="mr-2 h-4 w-4" />
              Nova atividade
            </Button>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[30px] border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Agenda imediata</div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">Atividades do dia</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecionadas para leitura rapida, com prioridade nas pendencias atrasadas e entregas de hoje.</p>
              </div>
              <div className="rounded-full border border-border/70 bg-muted/35 px-3 py-1 text-xs font-medium text-muted-foreground">
                {highlightedActivities.length} em destaque
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {highlightedActivities.length > 0 ? (
                highlightedActivities.map((activity) => {
                  const dueDate = getRelevantDate(activity);
                  const matchingTag = tags.find((tag) => activity.tags.includes(tag.id));
                  const isOverdue = Boolean(dueDate) && dueDate < todayKey;
                  const isDueToday = dueDate === todayKey;

                  return (
                    <div
                      key={activity.id}
                      role="button"
                      tabIndex={0}
                      className="group flex w-full cursor-pointer items-start gap-3 rounded-[22px] border border-border/60 bg-background px-4 py-4 text-left transition hover:border-primary/40 hover:bg-muted/20"
                      onClick={() => onOpenActivity(activity)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenActivity(activity);
                        }
                      }}
                    >
                      <Checkbox
                        checked={activity.completed}
                        onCheckedChange={() => onToggleComplete(activity.id)}
                        className="mt-1 h-5 w-5 rounded-full"
                        onClick={(event) => event.stopPropagation()}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-foreground">{activity.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{getProjectName(activity) || 'Sem projeto'}</span>
                              {getBlockedBy(activity) ? <span>Bloqueada</span> : null}
                              {activity.customFields[ACTIVITY_META.favorite] === true ? <span>Favorita</span> : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            {matchingTag ? (
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                style={{ backgroundColor: `${matchingTag.color}18`, color: matchingTag.color }}
                              >
                                {matchingTag.name}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                Sem tag
                              </span>
                            )}

                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold',
                                isOverdue
                                  ? 'bg-destructive/10 text-destructive'
                                  : isDueToday
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {formatDueDateLabel(dueDate, todayKey)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-dashed border-border bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma atividade critica para hoje. Um bom momento para organizar o restante da fila.
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
              <div className="text-sm text-muted-foreground">
                {overdueActivities.length > 0
                  ? `${overdueActivities.length} pendencia${overdueActivities.length > 1 ? 's' : ''} vencida${overdueActivities.length > 1 ? 's' : ''}`
                  : 'Nenhuma pendencia vencida'}
              </div>
              <Button variant="ghost" className="h-9 rounded-full px-3 text-primary" onClick={() => onOpenSection('activities')}>
                Ver todas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="rounded-[30px] border border-border/60 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Captura rapida</div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">Nota de hoje</h2>
                <p className="mt-1 text-sm text-muted-foreground">Mesmo editor rico das anotacoes, em escala compacta para caber na abertura do dia.</p>
              </div>
              <Button variant="ghost" className="h-9 rounded-full px-3 text-primary" onClick={() => onOpenSection('notes')}>
                Abrir editor
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4">
              <DashboardNoteEditor
                currentDate={currentDate}
                note={note}
                onReplaceContent={onReplaceNoteContent}
                onSave={onSaveNote}
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                autosaveEnabled={autosaveEnabled}
                hasUnsavedChanges={hasUnsavedChanges}
                saveStatus={saveStatus}
                noteTemplates={noteTemplates}
              />
            </div>
          </section>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.id} className="rounded-[24px] border border-border/60 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</span>
                  <div className={cn('rounded-2xl p-2', stat.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-foreground">{stat.value}</div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[30px] border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Em foco
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-foreground">Itens criticos do dia</h2>
              <p className="mt-1 text-sm text-muted-foreground">Uma leitura gerencial para nao perder bloqueios, prazos sensiveis e assuntos que travam o restante da operacao.</p>
            </div>
            <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => onOpenSection('activities')}>
              Revisar fila completa
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-[24px] border border-border/60 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                Visao rapida
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-muted/25 px-3 py-3">
                  <span className="text-sm text-muted-foreground">Prazos de hoje</span>
                  <span className="text-lg font-semibold text-foreground">
                    {todayActivities.filter((activity) => getRelevantDate(activity) === todayKey).length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/25 px-3 py-3">
                  <span className="text-sm text-muted-foreground">Dependencias abertas</span>
                  <span className="text-lg font-semibold text-foreground">{waitingActivities.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-muted/25 px-3 py-3">
                  <span className="text-sm text-muted-foreground">Nota de hoje</span>
                  <span className="text-sm font-medium text-foreground">
                    {note.lines.some((line) => line.content.trim()) ? 'Preenchida' : 'Vazia'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/60 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CircleDashed className="h-4 w-4 text-muted-foreground" />
                Atencao do dia
              </div>

              <div className="mt-4 space-y-3">
                {criticalItems.length > 0 ? (
                  criticalItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 rounded-[20px] border border-border/60 bg-muted/10 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{item.title}</div>
                        <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{item.context}</div>
                      </div>
                      <div className={cn('max-w-[45%] text-right text-sm font-medium', item.tone)}>{item.detail}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-border bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum item critico identificado para hoje.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
