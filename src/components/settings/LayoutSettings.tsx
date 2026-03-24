import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { LayoutSettings } from '@/types';
import { defaultLayoutSettings } from '@/lib/user-settings';

interface LayoutSettingsTabProps {
  layout: LayoutSettings;
  onUpdate: (updates: Partial<LayoutSettings>) => void;
}

export function LayoutSettingsTab({ layout, onUpdate }: LayoutSettingsTabProps) {
  const notesIsLastVisiblePanel = layout.showNotes && !layout.showActivities;
  const activitiesIsLastVisiblePanel = layout.showActivities && !layout.showNotes;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <Label className="font-medium">Mostrar abas</Label>
            <p className="text-sm text-muted-foreground">
              Exibe a barra de abas no layout mobile. Se ocultar, a troca fica no cabecalho.
            </p>
          </div>
          <Switch checked={layout.showTabs} onCheckedChange={(checked) => onUpdate({ showTabs: checked })} />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <Label className="font-medium">Mostrar notas</Label>
            <p className="text-sm text-muted-foreground">
              Exibe o editor principal de notas.
            </p>
          </div>
          <Switch
            checked={layout.showNotes}
            onCheckedChange={(checked) => onUpdate({ showNotes: checked })}
            disabled={notesIsLastVisiblePanel}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <Label className="font-medium">Mostrar lista de notas</Label>
            <p className="text-sm text-muted-foreground">
              No desktop vira painel lateral. Em tablet e mobile vira menu lateral.
            </p>
          </div>
          <Switch checked={layout.showNotesList} onCheckedChange={(checked) => onUpdate({ showNotesList: checked })} />
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div>
            <Label className="font-medium">Mostrar lista de atividades</Label>
            <p className="text-sm text-muted-foreground">
              Exibe o painel principal das atividades.
            </p>
          </div>
          <Switch
            checked={layout.showActivities}
            onCheckedChange={(checked) => onUpdate({ showActivities: checked })}
            disabled={activitiesIsLastVisiblePanel}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="font-medium">Tamanhos salvos</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Os tamanhos ajustados pelos divisores sao salvos automaticamente por usuario.
            </p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Desktop notas/atividades: {Math.round(layout.desktopMainPanelSize)}% / {Math.round(100 - layout.desktopMainPanelSize)}%</p>
              <p>Desktop lista de notas/notas: {Math.round(layout.desktopNotesListPanelSize)}% / {Math.round(100 - layout.desktopNotesListPanelSize)}%</p>
              <p>Tablet notas/atividades: {Math.round(layout.tabletNotesPanelSize)}% / {Math.round(100 - layout.tabletNotesPanelSize)}%</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => onUpdate(defaultLayoutSettings)}>
            Restaurar padrao
          </Button>
        </div>
      </div>
    </div>
  );
}
