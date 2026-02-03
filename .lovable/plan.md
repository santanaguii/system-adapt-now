
# Plano: Corrigir Persistencia das Configuracoes de Lista

## Diagnostico

As configuracoes de exibicao da lista (tags, prazo, prioridade, campos visiveis) nao estao sendo salvas porque:

1. **Colunas ausentes no banco**: Os campos `list_display`, `saved_filters` e `saved_sort` nao existem na tabela `user_settings`
2. **Updates silenciosos falham**: O codigo tenta salvar nessas colunas inexistentes, mas o erro e ignorado
3. **Valores resetam ao recarregar**: Como as colunas nao existem, retornam `null` e o sistema usa os valores padrao

---

## Solucao

Criar uma migracao Supabase para adicionar as tres colunas JSONB a tabela `user_settings`.

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/[timestamp]_add_list_display_columns.sql` | Migracao para adicionar colunas |

---

## Conteudo da Migracao

```sql
-- Adicionar colunas para configuracoes de exibicao da lista
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS list_display JSONB DEFAULT '{"showTags": true, "showDueDate": true, "showPriority": true, "visibleFieldIds": []}'::jsonb;

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS saved_filters JSONB DEFAULT '[]'::jsonb;

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS saved_sort JSONB DEFAULT '{"type": "manual", "direction": "asc"}'::jsonb;

-- Atualizar registros existentes que tem valores nulos
UPDATE user_settings 
SET list_display = '{"showTags": true, "showDueDate": true, "showPriority": true, "visibleFieldIds": []}'::jsonb
WHERE list_display IS NULL;

UPDATE user_settings 
SET saved_filters = '[]'::jsonb
WHERE saved_filters IS NULL;

UPDATE user_settings 
SET saved_sort = '{"type": "manual", "direction": "asc"}'::jsonb
WHERE saved_sort IS NULL;
```

---

## Verificacao do Codigo Existente

O codigo em `useSettings.ts` ja esta correto:

- Linhas 426-448: `updateListDisplay` ja faz update correto no campo `list_display`
- Linhas 451-469: `updateSavedFilters` ja faz update correto no campo `saved_filters`  
- Linhas 472-490: `updateSavedSort` ja faz update correto no campo `saved_sort`
- Linhas 148-163: Carrega os valores do banco com fallback para defaults

O problema e **apenas** a falta das colunas no banco.

---

## Passos de Implementacao

1. Criar arquivo de migracao SQL
2. Executar a migracao (automaticamente ao salvar)
3. Testar as configuracoes de lista:
   - Desabilitar "Mostrar Tags" e recarregar a pagina
   - A configuracao deve persistir

---

## Resultado Esperado

Apos a correcao:

- Toggle de "Mostrar Tags" persiste ao recarregar
- Toggle de "Mostrar Data de Prazo" persiste ao recarregar  
- Toggle de "Mostrar Prioridade" persiste ao recarregar
- Campos personalizados visiveis persistem ao recarregar
- Filtros salvos persistem ao recarregar
- Ordenacao padrao persiste ao recarregar
