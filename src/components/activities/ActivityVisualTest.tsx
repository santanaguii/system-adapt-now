import { Badge } from '@/components/ui/badge';
import { Activity, CustomField, Tag } from '@/types';
import { ArrowUpDown, Calendar, CheckCircle2, Clock, Filter, GripVertical, LayoutGrid, Layers, List, Sparkles, Table, Tag as TagIcon, Zap } from 'lucide-react';
import { getDateKeyInTimeZone, normalizeDateKey } from '@/lib/date';
import { getBlockedBy, getProjectName } from '@/lib/activity-meta';

interface ActivityVisualTestProps {
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  customFields: CustomField[];
  currentDate: Date;
}

type ActivityStatus = 'overdue' | 'onTrack' | 'noDueDate';

const statusConfig: Record<ActivityStatus, { label: string; color: string }> = {
  overdue: { label: 'Atrasada', color: 'border-rose-500/80 bg-rose-500/10 text-rose-600' },
  onTrack: { label: 'Em dia', color: 'border-emerald-500/80 bg-emerald-500/10 text-emerald-700' },
  noDueDate: { label: 'Sem prazo', color: 'border-slate-500/80 bg-slate-500/10 text-slate-700' },
};

const getActivityStatus = (activity: Activity, todayKey: string): ActivityStatus => {
  const dueDate = typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : null;
  const blockedBy = getBlockedBy(activity);

  if (!dueDate || Boolean(blockedBy)) {
    return 'noDueDate';
  }

  if (dueDate < todayKey) {
    return 'overdue';
  }

  return 'onTrack';
};

const renderTags = (activity: Activity, tags: Tag[]) => {
  const activityTags = tags.filter((tag) => activity.tags.includes(tag.id));
  if (activityTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {activityTags.slice(0, 3).map((tag) => (
        <Badge key={tag.id} variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
          {tag.name}
        </Badge>
      ))}
    </div>
  );
};

export function ActivityVisualTest({ activities, tags, currentDate }: ActivityVisualTestProps) {
  const todayKey = getDateKeyInTimeZone(currentDate);
  const previewActivities = activities.active.slice(0, 8);

  const groupedByStatus: Record<ActivityStatus, Activity[]> = {
    overdue: [],
    onTrack: [],
    noDueDate: [],
  };

  previewActivities.forEach((activity) => {
    groupedByStatus[getActivityStatus(activity, todayKey)].push(activity);
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto bg-background p-4 md:p-6">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Aba de teste</p>
            <h1 className="text-2xl font-semibold">Comparativo de visuais de atividades</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Quatro opções para mostrar como cada atividade pode ser apresentada. Escolha a visualização que melhor combina com sua rotina.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-950/5 p-3 text-sm text-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <List className="h-4 w-4" /> Lista compacta
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950/5 p-3 text-sm text-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <LayoutGrid className="h-4 w-4" /> Grid de foco
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Calendar className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 className="text-base font-semibold">1. Lista compacta</h2>
            <p className="text-sm text-muted-foreground">Uma visão enxuta com status e prazo.</p>
          </div>
        </div>
        <div className="space-y-2">
          {previewActivities.map((activity) => {
            const status = getActivityStatus(activity, todayKey);
            return (
              <div key={activity.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{activity.title}</span>
                    <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {renderTags(activity, tags)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Sparkles className="h-5 w-5 text-sky-500" />
          <div>
            <h2 className="text-base font-semibold">2. Cartões</h2>
            <p className="text-sm text-muted-foreground">Mais espaço para cada atividade, com destaque para status e projeto.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {previewActivities.map((activity) => {
            const status = getActivityStatus(activity, todayKey);
            const project = getProjectName(activity);
            return (
              <div key={activity.id} className={`rounded-3xl border-l-4 ${statusConfig[status].color} bg-card p-5 shadow-sm`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{activity.title}</h3>
                  <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{project || 'Sem projeto definido'}</p>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                  <span>{activity.completed ? 'Concluída' : 'Aberta'}</span>
                </div>
                <div className="mt-4">{renderTags(activity, tags)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <TagIcon className="h-5 w-5 text-orange-500" />
          <div>
            <h2 className="text-base font-semibold">3. Linha do tempo</h2>
            <p className="text-sm text-muted-foreground">Visualize atividades ordenadas por prazo em um fluxo vertical.</p>
          </div>
        </div>
        <div className="space-y-4">
          {previewActivities.map((activity, index) => {
            const status = getActivityStatus(activity, todayKey);
            return (
              <div key={activity.id} className="grid grid-cols-[auto_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${statusConfig[status].color}`}>
                    {index + 1}
                  </div>
                  {index < previewActivities.length - 1 && <div className="h-full w-px bg-border" />}
                </div>
                <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">{activity.title}</span>
                    <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                    {renderTags(activity, tags)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <LayoutGrid className="h-5 w-5 text-violet-500" />
          <div>
            <h2 className="text-base font-semibold">4. Grid de foco</h2>
            <p className="text-sm text-muted-foreground">Cards maiores para destacar poucas atividades importantes.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {previewActivities.map((activity) => {
            const status = getActivityStatus(activity, todayKey);
            return (
              <div key={activity.id} className={`rounded-3xl border ${statusConfig[status].color} bg-card p-5 shadow-sm`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{activity.title}</h3>
                  <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                </div>
                <div className="mt-4 text-sm leading-6 text-muted-foreground">
                  {activity.description || 'Resumo rápido da atividade para dar contexto ao foco.'}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">{renderTags(activity, tags)}</div>
                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                  <span>{getProjectName(activity) || 'Sem projeto'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Table className="h-5 w-5 text-cyan-500" />
          <div>
            <h2 className="text-base font-semibold">5. Tabela compacta</h2>
            <p className="text-sm text-muted-foreground">Uma visão tabular com colunas de prazo, status e projeto.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-background/80 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Projeto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {previewActivities.map((activity) => {
                const status = getActivityStatus(activity, todayKey);
                return (
                  <tr key={activity.id} className="hover:bg-background/50">
                    <td className="px-4 py-3 font-medium text-foreground">{activity.title}</td>
                    <td className="px-4 py-3"><Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getProjectName(activity) || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Clock className="h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-base font-semibold">6. Painel rápido</h2>
            <p className="text-sm text-muted-foreground">Cards com chamada para ação e prazos em destaque.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {previewActivities.map((activity) => {
            const status = getActivityStatus(activity, todayKey);
            return (
              <div key={activity.id} className={`rounded-3xl border ${statusConfig[status].color} bg-card p-5 shadow-sm`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{activity.title}</span>
                  <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                  <span>{getProjectName(activity) || 'Sem projeto'}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <button className="rounded-full border border-border px-3 py-1 text-slate-700">Editar</button>
                  <button className="rounded-full border border-border px-3 py-1 text-slate-700">Marcar</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Layers className="h-5 w-5 text-fuchsia-500" />
          <div>
            <h2 className="text-base font-semibold">7. Cartões por contextos</h2>
            <p className="text-sm text-muted-foreground">Agrupe cards por contexto visual com prioridade e deadline.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {['overdue', 'onTrack', 'noDueDate'].map((groupKey) => {
            const group = previewActivities.filter((activity) => getActivityStatus(activity, todayKey) === groupKey);
            if (group.length === 0) return null;
            return (
              <div key={groupKey} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{statusConfig[groupKey as ActivityStatus].label}</span>
                  <Badge className={statusConfig[groupKey as ActivityStatus].color}>{group.length}</Badge>
                </div>
                <div className="space-y-3">
                  {group.map((activity) => (
                    <div key={activity.id} className="rounded-2xl border border-border bg-background/80 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">{activity.title}</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                        <span>{getProjectName(activity) || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Zap className="h-5 w-5 text-lime-500" />
          <div>
            <h2 className="text-base font-semibold">8. Visão de prioridade</h2>
            <p className="text-sm text-muted-foreground">Foco nas tarefas mais urgentes com destaque de prazo.</p>
          </div>
        </div>
        <div className="space-y-3">
          {previewActivities.sort((a, b) => {
            const aStatus = getActivityStatus(a, todayKey);
            const bStatus = getActivityStatus(b, todayKey);
            const order: Record<ActivityStatus, number> = { overdue: 0, onTrack: 1, noDueDate: 2 };
            return order[aStatus] - order[bStatus];
          }).map((activity) => {
            const status = getActivityStatus(activity, todayKey);
            return (
              <div key={activity.id} className={`rounded-3xl border ${statusConfig[status].color} bg-card p-5 shadow-sm`}> 
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{getProjectName(activity) || 'Sem projeto'}</p>
                  </div>
                  <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</span>
                  <span>{activity.customFields.priority || 'Normal'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Table className="h-5 w-5 text-slate-600" />
          <div>
            <h2 className="text-base font-semibold">9. Lista com ações</h2>
            <p className="text-sm text-muted-foreground">Lista com controles de concluir, reprogramar e reordenar.</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
          <div className="grid min-w-full gap-3 px-4 py-4">
            <div className="grid grid-cols-[1.7fr_0.9fr_1.4fr] gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span>Atividade</span>
              <span>Prazo</span>
              <span className="text-right">Ações</span>
            </div>
            {previewActivities.map((activity) => {
              const status = getActivityStatus(activity, todayKey);
              return (
                <div key={activity.id} className="grid min-w-full grid-cols-[1.7fr_0.9fr_1.4fr] items-center gap-4 rounded-3xl border border-border bg-background/80 px-4 py-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{getProjectName(activity) || 'Sem projeto'}</p>
                      </div>
                      <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {renderTags(activity, tags)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>{typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}</div>
                    <div className="mt-1">{activity.customFields.priority || 'Normal'}</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-100 px-3 py-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Concluir
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-100 px-3 py-1">
                      <Calendar className="h-4 w-4 text-sky-500" />
                      Reprogramar
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-100 px-3 py-1">
                      <GripVertical className="h-4 w-4 text-slate-500" />
                      Reordenar
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Table className="h-5 w-5 text-slate-600" />
            <div>
              <h2 className="text-base font-semibold">10. Tabela interativa</h2>
              <p className="text-sm text-muted-foreground">Lista estilo tabela com filtros, ordenação e ações de reprogramação.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-100 px-3 py-2">
              <Filter className="h-4 w-4" />
              Filtro
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-slate-100 px-3 py-2">
              <ArrowUpDown className="h-4 w-4" />
              Ordenar
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
          <div className="min-w-full px-4 py-4">
            <div className="grid min-w-full grid-cols-[auto_auto_1.8fr_1fr_2.4fr] items-center gap-4 rounded-3xl bg-background/80 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="pl-2">Arrastar</span>
              <span>Concluir</span>
              <span>Atividade</span>
              <span>Prazo</span>
              <span>Reprogramar</span>
            </div>

            <div className="space-y-3 pt-4">
              {previewActivities.map((activity) => {
                const status = getActivityStatus(activity, todayKey);
                return (
                  <div key={activity.id} className="grid min-w-full grid-cols-[auto_auto_1.8fr_1fr_2.4fr] items-center gap-4 rounded-3xl border border-border bg-background/90 px-4 py-4">
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50">
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-white text-slate-500 shadow-sm hover:bg-slate-50">
                      <div className="h-4 w-4 rounded-sm border border-slate-400 bg-white" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-foreground">{activity.title}</p>
                        <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{getProjectName(activity) || 'Sem projeto'}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {typeof activity.customFields.dueDate === 'string' ? normalizeDateKey(activity.customFields.dueDate) : 'Sem prazo'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50">Hoje</button>
                      <button type="button" className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50">Amanhã</button>
                      <button type="button" className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50">+7 dias</button>
                      <button type="button" className="rounded-full border border-border bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50">S/data</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
