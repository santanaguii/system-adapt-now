import { Button } from '@/components/ui/button';
import { Activity, DailyNote, Tag } from '@/types';
import { getBlockedBy, getProjectName, getScheduledDate, shouldShowInToday } from '@/lib/activity-meta';
import { getDateKeyInTimeZone, normalizeDateKey, parseDateKey } from '@/lib/date';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckSquare, Clock3, FileText, NotebookPen } from 'lucide-react';

type DashboardSection = 'dashboard' | 'activities' | 'notes';

interface DashboardOverviewProps {
  currentDate: Date;
  note: DailyNote;
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  onOpenSection: (section: Exclude<DashboardSection, 'dashboard'>) => void;
}

function getRelevantDate(activity: Activity) {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
  return dueDate || getScheduledDate(activity);
}

function formatDueDateLabel(dateKey: string | null, todayKey: string) {
  if (!dateKey) {
    return 'Sem prazo';
  }

  if (dateKey < todayKey) {
    return `Atrasada desde ${format(parseDateKey(dateKey), 'dd/MM', { locale: ptBR })}`;
  }

  if (dateKey === todayKey) {
    return 'Prazo hoje';
  }

  return format(parseDateKey(dateKey), 'dd/MM', { locale: ptBR });
}

function getLinePreview(line: DailyNote['lines'][number]) {
  const content = line.content.trim();
  if (!content) {
    return null;
  }

  return {
    id: line.id,
    content,
    tone:
      line.type === 'title'
        ? 'text-base font-semibold text-foreground'
        : line.type === 'subtitle'
          ? 'text-sm font-semibold text-foreground'
          : line.type === 'quote'
            ? 'border-l-2 border-amber-500/60 pl-3 italic text-muted-foreground'
            : line.type === 'comment'
              ? 'text-sm text-muted-foreground/80'
              : 'text-sm text-foreground/90',
  };
}

export function DashboardOverview({
  currentDate,
  note,
  activities,
  tags,
  onOpenSection,
}: DashboardOverviewProps) {
  const todayKey = getDateKeyInTimeZone(currentDate);
  const allActive = activities.active;
  const todayActivities = allActive.filter((activity) => shouldShowInToday(activity, todayKey));
  const overdueActivities = allActive.filter((activity) => {
    const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
    return Boolean(dueDate) && dueDate < todayKey;
  });
  const waitingActivities = allActive.filter((activity) => Boolean(getBlockedBy(activity)));
  const notePreview = note.lines.map(getLinePreview).filter((item): item is NonNullable<ReturnType<typeof getLinePreview>> => item !== null).slice(0, 8);
  const highlightedActivities = [...allActive]
    .sort((left, right) => {
      const leftDate = getRelevantDate(left) ?? '9999-12-31';
      const rightDate = getRelevantDate(right) ?? '9999-12-31';
      if (leftDate !== rightDate) {
        return leftDate.localeCompare(rightDate);
      }
      return left.order - right.order;
    })
    .slice(0, 6);

  const stats = [
    {
      id: 'active',
      label: 'Atividades abertas',
      value: allActive.length,
      icon: CheckSquare,
    },
    {
      id: 'today',
      label: 'Foco de hoje',
      value: todayActivities.length,
      icon: Clock3,
    },
    {
      id: 'note-lines',
      label: 'Linhas na nota',
      value: note.lines.filter((line) => line.content.trim()).length,
      icon: NotebookPen,
    },
    {
      id: 'waiting',
      label: 'Bloqueadas',
      value: waitingActivities.length,
      icon: FileText,
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(250,246,239,0.9),rgba(248,242,233,0.55))] px-4 py-4 dark:bg-none">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-[28px] border border-[#ddd1c1] bg-[#fbf7f1] p-5 shadow-[0_12px_40px_rgba(89,68,42,0.08)] dark:border-border dark:bg-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-500">
                Dashboard
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">
                {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Resumo rapido das suas atividades e anotacoes do dia.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => onOpenSection('notes')}>
                Ver anotacoes
              </Button>
              <Button className="rounded-full" onClick={() => onOpenSection('activities')}>
                Ver atividades
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.id} className="rounded-2xl border border-[#e8ddcf] bg-[#f6efe5] px-4 py-4 dark:border-border dark:bg-muted/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      {stat.label}
                    </span>
                    <Icon className="h-4 w-4 text-stone-500" />
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-foreground">{stat.value}</div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
          <section className="rounded-[28px] border border-[#ddd1c1] bg-[#fbf7f1] p-5 shadow-[0_12px_40px_rgba(89,68,42,0.06)] dark:border-border dark:bg-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Anotacoes
                </div>
                <h2 className="mt-2 text-lg font-semibold text-foreground">Nota do dia</h2>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenSection('notes')}>
                Abrir
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e8ddcf] bg-white/65 p-4 dark:border-border dark:bg-muted/30">
              {notePreview.length > 0 ? (
                <div className="space-y-3">
                  {notePreview.map((line) => (
                    <div key={line.id} className={line.tone}>
                      {line.content}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Nenhuma anotacao preenchida para hoje ainda.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#ddd1c1] bg-[#fbf7f1] p-5 shadow-[0_12px_40px_rgba(89,68,42,0.06)] dark:border-border dark:bg-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Atividades
                </div>
                <h2 className="mt-2 text-lg font-semibold text-foreground">Proximas prioridades</h2>
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenSection('activities')}>
                Abrir
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {highlightedActivities.length > 0 ? (
                highlightedActivities.map((activity) => {
                  const dueDate = getRelevantDate(activity);
                  const matchingTag = tags.find((tag) => activity.tags.includes(tag.id));

                  return (
                    <div key={activity.id} className="rounded-2xl border border-[#e8ddcf] bg-white/70 p-4 dark:border-border dark:bg-muted/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{activity.title}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{formatDueDateLabel(dueDate, todayKey)}</span>
                            {getProjectName(activity) && <span>{getProjectName(activity)}</span>}
                            {getBlockedBy(activity) && <span>Bloqueada</span>}
                          </div>
                        </div>
                        {matchingTag ? (
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
                            style={{ backgroundColor: `${matchingTag.color}18`, color: matchingTag.color }}
                          >
                            {matchingTag.name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d9cbb8] px-4 py-5 text-sm text-muted-foreground dark:border-border">
                  Nenhuma atividade aberta no momento.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e8ddcf] bg-[#f6efe5] px-4 py-3 dark:border-border dark:bg-muted/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Atrasadas</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{overdueActivities.length}</div>
              </div>
              <div className="rounded-2xl border border-[#e8ddcf] bg-[#f6efe5] px-4 py-3 dark:border-border dark:bg-muted/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Concluidas</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{activities.completed.length}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
