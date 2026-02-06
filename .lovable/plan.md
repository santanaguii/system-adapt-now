

# Plano: Adicionar tipo "Comentario" e botao para ocultar/exibir comentarios

## Resumo

Adicionar um novo tipo de linha "comment" (comentario) ao editor de notas, com estilo visual diferenciado (cor clara e italico), e um botao toggle no header para ocultar/exibir todas as linhas de comentario.

---

## Alteracoes por arquivo

### 1. `src/types/index.ts`

Adicionar `'comment'` ao tipo `LineType`:

```typescript
export type LineType = 'paragraph' | 'title' | 'subtitle' | 'quote' | 'bullet' | 'comment';
```

### 2. `src/components/notes/NoteLine.tsx`

Adicionar estilo do comentario no objeto `lineTypeClasses`:

```typescript
comment: 'text-sm text-muted-foreground/70 italic pl-4',
```

Adicionar placeholder para o tipo comment:

```typescript
line.type === 'comment' ? 'Comentário...' : 'Escreva aqui...'
```

### 3. `src/components/notes/NoteEditor.tsx`

**3a. Novo estado para controlar visibilidade dos comentarios:**

```typescript
const [hideComments, setHideComments] = useState(false);
```

**3b. Filtrar linhas de comentario no `getVisibleLines`:**

Adicionar verificacao: se `hideComments` for `true`, pular linhas com `type === 'comment'`.

**3c. Botao toggle no header (ao lado de undo/redo):**

Usar o icone `MessageSquareOff` (comentarios ocultos) ou `MessageSquare` (comentarios visiveis) do lucide-react.

**3d. Atalho de teclado Ctrl+5 para tipo comentario:**

Adicionar caso `'5'` no switch de atalhos que define o tipo da linha.

**3e. Atualizar barra de atalhos:**

Adicionar `Ctrl+5: Comentário` na lista de hints.

---

## Detalhes tecnicos

| Item | Detalhe |
|------|---------|
| Arquivos modificados | `src/types/index.ts`, `src/components/notes/NoteLine.tsx`, `src/components/notes/NoteEditor.tsx` |
| Novos componentes | Nenhum |
| Banco de dados | Nenhuma alteracao necessaria (o tipo e salvo como string no campo `type` da linha) |
| Icones | `MessageSquare` e `MessageSquareOff` do lucide-react |

---

## Visual esperado

- **Comentario visivel**: texto em tamanho menor, cor `muted-foreground/70`, italico, com leve recuo a esquerda
- **Botao toggle**: icone no header que alterna entre mostrar/ocultar comentarios, com tooltip indicando o estado atual
- **Atalho**: Ctrl+5 converte a linha atual em comentario

