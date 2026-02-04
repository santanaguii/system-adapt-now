
# Plano: Corrigir Lista de Notas para Mostrar Apenas Dias com Conteudo

## Diagnostico

O problema esta na **conversao desnecessaria** em `Index.tsx` linha 185:

```typescript
const allDatesWithNotesStrings = allDatesWithNotes.map(d => format(d, 'yyyy-MM-dd'));
```

### Por que esta errado?

1. O hook `useNotes.ts` ja retorna **strings** no formato `'yyyy-MM-dd'`:
   ```typescript
   // useNotes.ts linha 437-443
   const allDatesWithNotes = useMemo(() => {
     return notes
       .filter((n) => n.lines.some((l) => l.content.trim() !== ''))
       .map((n) => n.date)  // n.date ja e string 'yyyy-MM-dd'
       .sort()
       .reverse();
   }, [notes]);
   ```

2. Mas `Index.tsx` tenta usar `format()` do date-fns em strings:
   - `format("2025-02-03", 'yyyy-MM-dd')` pode interpretar como UTC
   - Isso causa deslocamento de fuso horario e datas erradas

3. A filtragem esta correta no hook, mas os dados chegam corrompidos na UI

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Index.tsx` | Remover conversao desnecessaria, usar `allDatesWithNotes` diretamente |

---

## Alteracao

**Linha 184-185** de `Index.tsx`:

```typescript
// ANTES (incorreto - tenta formatar strings)
const allDatesWithNotesStrings = allDatesWithNotes.map(d => format(d, 'yyyy-MM-dd'));

// DEPOIS (correto - usa diretamente as strings do hook)
// Remover essa linha e usar allDatesWithNotes diretamente nos props
```

**Linha 200** - Atualizar a prop:

```typescript
// ANTES
allDatesWithNotes: allDatesWithNotesStrings,

// DEPOIS
allDatesWithNotes: allDatesWithNotes,
```

---

## Resultado Esperado

Apos a correcao:

1. A lista de notas mostrara **apenas dias que tem notas com conteudo**
2. Os dias serao exibidos corretamente sem deslocamento de fuso horario
3. A filtragem do hook sera preservada corretamente

---

## Impacto

- Apenas 1 arquivo modificado
- Remocao de codigo desnecessario (1 linha)
- Atualizacao de 1 referencia
