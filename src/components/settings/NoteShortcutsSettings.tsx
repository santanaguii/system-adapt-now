import { noteFormattingBehaviorHints, noteFormattingPrefixHints, noteFormattingShortcutHints } from '@/lib/note-shortcuts';

export function NoteShortcutsSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Atalhos de teclado</h3>
        <p className="text-sm text-muted-foreground">
          Funcionam na linha selecionada do editor de notas.
        </p>
        <div className="space-y-2">
          {noteFormattingShortcutHints.map((hint) => (
            <div key={hint.shortcut} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{hint.label}</div>
                <div className="text-xs text-muted-foreground">Aplica o formato diretamente na linha</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-sm border bg-background px-2 py-1 font-medium text-foreground">{hint.shortcut}</span>
                <span className="rounded-sm border border-dashed px-2 py-1 text-foreground">{hint.prefix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Prefixos digitados</h3>
        <p className="text-sm text-muted-foreground">
          Digite o prefixo no inicio da linha para converter automaticamente o tipo.
        </p>
        <div className="space-y-2">
          {noteFormattingPrefixHints.map((hint) => (
            <div key={`${hint.prefix}-${hint.label}`} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">{hint.label}</span>
              <span className="rounded-sm border border-dashed px-2 py-1 text-xs font-medium text-foreground">{hint.prefix}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Comportamento</h3>
        <div className="space-y-2">
          {noteFormattingBehaviorHints.map((hint) => (
            <div key={hint} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {hint}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
