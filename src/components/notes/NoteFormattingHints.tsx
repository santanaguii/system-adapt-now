import { noteFormattingShortcutHints } from '@/lib/note-shortcuts';

export function NoteFormattingHints() {
  return (
    <div className="shrink-0 border-t bg-muted/20 px-4 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {noteFormattingShortcutHints.map((hint) => (
          <div key={hint.shortcut} className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-medium text-foreground">{hint.shortcut}</span>
            <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[10px] text-foreground">
              {hint.prefix}
            </span>
            <span>{hint.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
