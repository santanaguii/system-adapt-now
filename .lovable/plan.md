
# Plano: Conectar ao Supabase Externo

## Resumo

Migrar toda a persistência de dados do **localStorage** para o seu projeto Supabase externo, mantendo cada usuário com dados completamente independentes (notas, atividades, tags, campos customizados e configurações).

---

## Estrutura de Isolamento por Usuário

```text
Usuário A                          Usuário B
─────────────────────             ─────────────────────
├── Notas de A                    ├── Notas de B
├── Atividades de A               ├── Atividades de B
├── Tags de A                     ├── Tags de B
│   └── "Trabalho", "Casa"        │   └── "Projeto X", "Urgente"
├── Campos Customizados de A      ├── Campos Customizados de B
│   └── "Cliente", "Valor"        │   └── "Responsável", "Status"
└── Configurações de A            └── Configurações de B
```

Cada tabela possui a coluna `user_id` com políticas RLS que garantem acesso apenas aos próprios dados.

---

## Etapa 1: Atualizar Credenciais

Modificar o arquivo `.env` para apontar para seu Supabase:

| Variável | Valor |
|----------|-------|
| VITE_SUPABASE_URL | https://rezbeuxknwdykpphomcq.supabase.co |
| VITE_SUPABASE_PUBLISHABLE_KEY | eyJhbGci... (sua chave) |
| VITE_SUPABASE_PROJECT_ID | rezbeuxknwdykpphomcq |

---

## Etapa 2: Reescrever Autenticação

### Arquivo: `src/hooks/useAuth.ts`

**Mudanças principais:**

| Antes (localStorage) | Depois (Supabase) |
|---------------------|-------------------|
| Hash SHA-256 no navegador | `supabase.auth.signUp()` |
| Array `app_users` | Tabela `profiles` + auth.users |
| `current_user_id` local | Sessão automática do Supabase |

**Estratégia para manter login com username:**
- Converter username para email interno: `joao` → `joao@app.internal`
- Supabase Auth gerencia a sessão
- Tabela `profiles` armazena username e pergunta de segurança

**Fluxos:**

```text
CADASTRO
────────
1. Verificar se username existe (RPC check_username_exists)
2. supabase.auth.signUp({ email: username@app.internal, password })
3. Inserir na tabela profiles { id, username, security_question, security_answer_hash }
4. Criar dados padrão (tags, campos, settings)

LOGIN
─────
1. supabase.auth.signInWithPassword({ email: username@app.internal, password })
2. Buscar perfil na tabela profiles
3. Retornar usuário autenticado

RECUPERAR SENHA
───────────────
1. Buscar pergunta via RPC get_security_question(username)
2. Verificar resposta via RPC verify_security_answer(username, hash)
3. Se válido: supabase.auth.updateUser({ password: newPassword })
```

---

## Etapa 3: Reescrever Notas

### Arquivo: `src/hooks/useNotes.ts`

**Mudanças:**
- Buscar notas do banco filtradas por `user_id`
- Salvar linhas com debounce (1 segundo)
- Manter undo/redo no estado local (não persistir histórico)

**Funções:**

| Função | Antes | Depois |
|--------|-------|--------|
| `getNote` | localStorage | `supabase.from('notes').select()` |
| `saveNote` | localStorage | `supabase.from('notes').upsert()` |
| `updateLine` | localStorage | `supabase.from('note_lines').update()` |
| `addLine` | localStorage | `supabase.from('note_lines').insert()` |
| `deleteLine` | localStorage | `supabase.from('note_lines').delete()` |

**Estrutura no banco:**

```text
notes (user_id, date, updated_at)
  └── note_lines (note_id, content, line_type, indent, collapsed, sort_order)
```

---

## Etapa 4: Reescrever Atividades

### Arquivo: `src/hooks/useActivities.ts`

**Mudanças:**
- CRUD completo via Supabase
- Manter ordenação manual (sort_order)
- Otimistic updates para UX fluida

**Funções:**

| Função | Implementação |
|--------|---------------|
| `addActivity` | `supabase.from('activities').insert()` |
| `updateActivity` | `supabase.from('activities').update()` |
| `deleteActivity` | `supabase.from('activities').delete()` |
| `toggleComplete` | `supabase.from('activities').update()` |
| `reorderActivities` | Batch update de sort_order |

---

## Etapa 5: Reescrever Configurações

### Arquivo: `src/hooks/useSettings.ts`

**Separação em 3 tabelas (cada uma isolada por user_id):**

| Dado | Tabela |
|------|--------|
| Tags | `tags` (user_id, name, color) |
| Campos customizados | `custom_fields` (user_id, key, name, field_type, options...) |
| Configurações gerais | `user_settings` (user_id, allow_reopen, default_sort...) |

**Dados padrão no primeiro acesso:**

Ao cadastrar um novo usuário, criar automaticamente:

- **3 Tags:** Trabalho, Pessoal, Urgente
- **3 Campos:** Prazo (date), Prioridade (single_select), Descrição (long_text)
- **Configurações:** allowReopenCompleted=true, defaultSort=manual, creationMode=simple

---

## Etapa 6: Atualizar AuthContext

### Arquivo: `src/contexts/AuthContext.tsx`

**Mudanças:**
- Registrar `onAuthStateChange` ANTES de `getSession()`
- Carregar perfil após detectar sessão
- Limpar estado ao fazer logout

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `.env` | Atualizar credenciais para seu Supabase |
| `src/hooks/useAuth.ts` | Reescrever para Supabase Auth + profiles |
| `src/hooks/useNotes.ts` | Reescrever para buscar/salvar no banco |
| `src/hooks/useActivities.ts` | Reescrever para CRUD no banco |
| `src/hooks/useSettings.ts` | Reescrever para sincronizar 3 tabelas |
| `src/contexts/AuthContext.tsx` | Ajustar para sessão do Supabase |

---

## Segurança: Isolamento por Usuário

Todas as tabelas usam RLS com a regra:

```sql
USING (auth.uid() = user_id)
```

Isso garante que:
- Usuário A nunca vê dados de B
- Tags de A não aparecem para B
- Campos customizados de A são exclusivos de A
- Cada usuário tem seu próprio ambiente

---

## Funcionalidades Preservadas

| Funcionalidade | Status |
|----------------|--------|
| Login com username | Mantido (email interno) |
| Cadastro com pergunta segurança | Mantido |
| Recuperação de senha | Mantido |
| Editor de notas hierárquico | Mantido |
| Tipos de linha (título, subtítulo, etc) | Mantido |
| Indentação e colapso | Mantido |
| Undo/Redo | Mantido (local) |
| Atalhos de teclado | Mantido |
| Atividades com drag-and-drop | Mantido |
| Tags coloridas | Mantido (por usuário) |
| Campos customizados | Mantido (por usuário) |
| Filtros e ordenação | Mantido |

---

## Ordem de Implementação

1. Atualizar `.env` com suas credenciais
2. Reescrever `useAuth.ts` para Supabase Auth
3. Atualizar `AuthContext.tsx` para sessão
4. Reescrever `useSettings.ts` com seed de dados padrão
5. Reescrever `useNotes.ts` com debounce
6. Reescrever `useActivities.ts` com otimistic updates
7. Testar fluxo completo

---

## Detalhes Técnicos

### Hash da Resposta de Segurança

Manterei o mesmo método SHA-256 usado atualmente. O hash é calculado no frontend e armazenado na tabela `profiles`.

### Debounce para Notas

Para evitar muitas requisições durante digitação, as notas serão salvas com debounce de 1 segundo.

### Otimistic Updates

Para melhor experiência, as atividades atualizam a interface imediatamente enquanto a requisição é processada em background.

### Criação de Dados Padrão

No cadastro, após criar o perfil, automaticamente crio:
- Tags padrão na tabela `tags`
- Campos padrão na tabela `custom_fields`
- Configurações na tabela `user_settings`
