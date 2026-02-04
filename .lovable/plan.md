
# Plano: Corrigir Lista de Notas e Permitir Editar Nomes de Campos Personalizados

## Problemas Identificados

### 1. Lista de Notas Filtrando Dias Errado

O problema esta em **dois locais** onde strings de data sao convertidas para objetos `Date` usando `new Date(dateStr)`:

**Arquivo: `src/components/notes/NoteEditor.tsx`**
- **Linha 303-306**: `onDateChange(new Date(date))` - quando seleciona uma data da lista de notas
- **Linha 313**: `onDateChange(new Date(result.date))` - quando seleciona um resultado de busca
- **Linha 317**: `format(new Date(result.date), ...)` - quando formata a data do resultado

**O problema**: Usar `new Date("2025-02-03")` interpreta a string como UTC meia-noite, que ao converter para horario local pode resultar em um dia diferente (por exemplo, 2 de fevereiro as 21h em UTC-3).

**Solucao**: Usar parsing manual com split para criar a data em horario local:
```typescript
// ANTES (problematico)
onDateChange(new Date(date));

// DEPOIS (correto)
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
onDateChange(parseDateString(date));
```

### 2. Editar Nome de Campos Personalizados

Atualmente, a aba "Campos" em `src/components/settings/SettingsPanel.tsx` permite:
- Habilitar/desabilitar campos (Switch)
- Editar opcoes de campos do tipo selecao
- Excluir campos

**Mas NAO permite editar o nome do campo** - o nome e exibido apenas como texto estatico na linha 231.

**Solucao**: Substituir o texto estatico por um Input editavel (similar ao que ja existe para Tags na linha 338-340).

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/notes/NoteEditor.tsx` | Adicionar funcao `parseDateString` e usar nos 3 locais onde `new Date(dateStr)` e usado |
| `src/components/settings/SettingsPanel.tsx` | Substituir texto estatico do nome do campo por Input editavel |

---

## Alteracoes Detalhadas

### 1. NoteEditor.tsx - Corrigir parsing de datas

Adicionar funcao auxiliar no inicio do componente:
```typescript
// Parse date string to local Date (avoiding UTC interpretation)
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};
```

Atualizar os tres locais:

**Linha 303-306** (NotesList callback):
```typescript
// DE:
onDateChange(new Date(date));

// PARA:
onDateChange(parseDateString(date));
```

**Linha 313** (resultado de busca):
```typescript
// DE:
onDateChange(new Date(result.date));

// PARA:
onDateChange(parseDateString(result.date));
```

**Linha 317** (formatacao de resultado):
```typescript
// DE:
format(new Date(result.date), "d 'de' MMMM", { locale: ptBR })

// PARA:
format(parseDateString(result.date), "d 'de' MMMM", { locale: ptBR })
```

### 2. SettingsPanel.tsx - Permitir editar nome do campo

**Linha 230-235** - Substituir o paragrafo estatico por um Input:
```typescript
// DE:
<div className="flex-1">
  <p className="font-medium">{field.name}</p>
  <p className="text-xs text-muted-foreground">
    {fieldTypes.find((t) => t.value === field.type)?.label}
    {field.required && ' • Obrigatório'}
  </p>
</div>

// PARA:
<div className="flex-1 space-y-1">
  <Input
    value={field.name}
    onChange={(e) => onUpdateField(field.id, { name: e.target.value })}
    className="h-7 text-sm font-medium"
  />
  <p className="text-xs text-muted-foreground">
    {fieldTypes.find((t) => t.value === field.type)?.label}
    {field.required && ' • Obrigatório'}
  </p>
</div>
```

---

## Resultado Esperado

Apos as correcoes:

1. **Lista de notas**: Clicar em uma data na lista ou em um resultado de busca navega para o dia correto (sem deslocamento de fuso horario)

2. **Campos personalizados**: O nome de cada campo pode ser editado diretamente clicando no texto e digitando o novo nome

---

## Impacto

- Nenhuma alteracao de banco de dados necessaria
- Nenhum novo componente necessario
- Alteracoes localizadas em apenas 2 arquivos
