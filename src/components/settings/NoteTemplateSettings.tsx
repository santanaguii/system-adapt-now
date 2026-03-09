import { NoteTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { parseNoteTemplateLines, serializeNoteTemplateLines } from '@/lib/note-templates';

interface NoteTemplateSettingsProps {
  templates: NoteTemplate[];
  onUpdate: (templates: NoteTemplate[]) => void;
}

export function NoteTemplateSettingsTab({ templates, onUpdate }: NoteTemplateSettingsProps) {
  const updateTemplate = (templateId: string, updates: Partial<NoteTemplate>) => {
    onUpdate(templates.map((template) => (template.id === templateId ? { ...template, ...updates } : template)));
  };

  const removeTemplate = (templateId: string) => {
    onUpdate(templates.filter((template) => template.id !== templateId));
  };

  const addTemplate = () => {
    onUpdate([
      ...templates,
      {
        id: crypto.randomUUID(),
        name: 'Novo template',
        lines: [{ content: '', type: 'paragraph' }],
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Edite os templates do editor de notas. Use uma linha por bloco e os prefixos `#`, `##`, `-`, `&gt;` e `//` para definir o formato.
      </div>

      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.id} className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-3">
              <Input
                value={template.name}
                onChange={(event) => updateTemplate(template.id, { name: event.target.value })}
                className="h-8 flex-1"
                placeholder="Nome do template"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeTemplate(template.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Conteudo</Label>
              <Textarea
                rows={8}
                className="min-h-40"
                value={serializeNoteTemplateLines(template.lines)}
                onChange={(event) => updateTemplate(template.id, { lines: parseNoteTemplateLines(event.target.value) })}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={addTemplate}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar template
      </Button>
    </div>
  );
}
