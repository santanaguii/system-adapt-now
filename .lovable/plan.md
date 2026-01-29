
# Plano: Adicionar Seleção de Tags na Criação de Atividades

## Objetivo
Permitir selecionar tags (opcionais) ao criar uma nova atividade, tanto no modo **simples** quanto no modo **detalhado**.

---

## Visão Geral das Mudanças

### Modo Simples (atual)
```
[Input: Nova atividade...] [+]
```

### Modo Simples (novo)
```
[Input: Nova atividade...] [🏷️] [+]
         [Tag1] [Tag2]  <- badges das tags selecionadas
```

### Modo Detalhado (atual)
- Dialog com: Título + Campos customizados (prazo, prioridade, etc.)

### Modo Detalhado (novo)
- Dialog com: Título + **Seção de Tags** + Campos customizados

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useActivities.ts` | Adicionar parâmetro opcional `initialTags` na função `addActivity` |
| `src/components/activities/ActivityList.tsx` | Adicionar UI de seleção de tags nos dois modos |
| `src/pages/Index.tsx` | Atualizar tipagem do `onAdd` (se necessário) |

---

## Detalhes Técnicos

### 1. Hook `useActivities.ts` (Linha 76)

**Antes:**
```typescript
const addActivity = useCallback(async (title: string) => {
  ...
  tags: [],
```

**Depois:**
```typescript
const addActivity = useCallback(async (title: string, initialTags?: string[]) => {
  ...
  tags: initialTags || [],
```

### 2. Componente `ActivityList.tsx`

#### 2.1 Novo estado para tags na criação
Adicionar após linha 149:
```typescript
const [newActivityTags, setNewActivityTags] = useState<string[]>([]);
```

#### 2.2 Atualizar interface `ActivityListProps` (Linha 63)
```typescript
onAdd: (title: string, tags?: string[]) => Promise<Activity | null> | Activity | null;
```

#### 2.3 Atualizar handlers de criação

**handleAddActivitySimple (Linha 162):**
```typescript
const handleAddActivitySimple = () => {
  if (newActivityTitle.trim()) {
    onAdd(newActivityTitle.trim(), newActivityTags.length > 0 ? newActivityTags : undefined);
    setNewActivityTitle('');
    setNewActivityTags([]); // Reset após criar
  }
};
```

**handleAddActivityDetailed (Linha 169):**
```typescript
const handleAddActivityDetailed = async () => {
  if (newActivityTitle.trim()) {
    const newActivity = await onAdd(newActivityTitle.trim(), newActivityTags.length > 0 ? newActivityTags : undefined);
    if (newActivity && Object.keys(newActivityFields).length > 0) {
      onUpdate(newActivity.id, { customFields: newActivityFields as Activity['customFields'] });
    }
    setNewActivityTitle('');
    setNewActivityFields({});
    setNewActivityTags([]); // Reset após criar
    setShowNewActivityDialog(false);
  }
};
```

#### 2.4 UI do Modo Simples (Linhas 372-384)

Adicionar um Popover com seleção de tags ao lado do input:

```tsx
<div className="flex flex-col gap-2 px-4 py-3 border-b">
  <div className="flex items-center gap-2">
    <Input
      placeholder="Nova atividade..."
      value={newActivityTitle}
      onChange={(e) => setNewActivityTitle(e.target.value)}
      onKeyDown={handleKeyDown}
      className="flex-1"
    />
    {/* Botão de Tags */}
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          <Tag className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="space-y-1">
          <p className="text-sm font-medium mb-2">Selecionar tags</p>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={newActivityTags.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleNewActivityTag(tag.id)}
                style={{
                  backgroundColor: newActivityTags.includes(tag.id) ? tag.color : 'transparent',
                  borderColor: tag.color,
                  color: newActivityTags.includes(tag.id) ? 'white' : tag.color
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
    <Button size="icon" onClick={handlePlusClick} disabled={!newActivityTitle.trim()}>
      <Plus className="h-4 w-4" />
    </Button>
  </div>
  {/* Tags selecionadas */}
  {newActivityTags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {newActivityTags.map((tagId) => {
        const tag = tags.find(t => t.id === tagId);
        if (!tag) return null;
        return (
          <Badge
            key={tagId}
            style={{ backgroundColor: tag.color }}
            className="text-white text-xs"
          >
            {tag.name}
          </Badge>
        );
      })}
    </div>
  )}
</div>
```

#### 2.5 UI do Modo Detalhado (Dialog - após Título, antes dos campos customizados)

Adicionar seção de tags no dialog (após linha 495):

```tsx
{/* Seção de Tags (opcional) */}
<div className="space-y-2">
  <Label>Tags</Label>
  <div className="flex flex-wrap gap-2">
    {tags.map((tag) => (
      <Badge
        key={tag.id}
        variant={newActivityTags.includes(tag.id) ? "default" : "outline"}
        className="cursor-pointer transition-colors"
        onClick={() => toggleNewActivityTag(tag.id)}
        style={{
          backgroundColor: newActivityTags.includes(tag.id) ? tag.color : 'transparent',
          borderColor: tag.color,
          color: newActivityTags.includes(tag.id) ? 'white' : tag.color
        }}
      >
        {tag.name}
      </Badge>
    ))}
    {tags.length === 0 && (
      <span className="text-sm text-muted-foreground">
        Nenhuma tag disponível. Crie tags nas configurações.
      </span>
    )}
  </div>
</div>
```

#### 2.6 Função helper para toggle de tags
Adicionar após linha 218:

```typescript
const toggleNewActivityTag = useCallback((tagId: string) => {
  setNewActivityTags((prev) =>
    prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
  );
}, []);
```

#### 2.7 Importações necessárias
Adicionar `Tag` ao import do lucide-react:
```typescript
import { Plus, Filter, Settings, ChevronDown, ChevronUp, Search, ArrowUpDown, Tag } from 'lucide-react';
```

Adicionar import do Popover:
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```

---

## Comportamento

1. **Tags são opcionais** - O usuário pode criar atividades sem selecionar nenhuma tag
2. **Toggle visual** - Tags selecionadas ficam com fundo colorido, não selecionadas ficam com borda
3. **Reset após criação** - As tags selecionadas são limpas após criar a atividade
4. **Mensagem quando vazio** - No modo detalhado, se não houver tags, mostra mensagem orientando a criar nas configurações
