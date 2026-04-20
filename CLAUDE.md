# CLAUDE.md — Mapa do Sistema "Pauta"

> Referência completa para agentes. Leia este arquivo antes de qualquer alteração — ele descreve o sistema, onde cada coisa está e como funciona. Não explore o codebase do zero; use este mapa.

---

## 1. VISÃO GERAL

**Nome:** Pauta  
**Tipo:** SPA (Single Page Application) — sistema pessoal de organização  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Supabase  
**Idioma:** Português brasileiro (pt-BR), timezone `America/Sao_Paulo`  
**Mobile:** Capacitor 8 (Android build)

### Resumo funcional
O sistema tem **dois módulos principais** que coexistem na mesma tela:
1. **Atividades** — gerenciamento de tarefas com campos customizados, tags, recorrência, dependências, subtarefas
2. **Anotações** — editor de notas diárias (uma nota por data) com múltiplos tipos de linha, templates e busca

Existe ainda um **Dashboard** com resumo estatístico e um sistema completo de **configurações** (aparência, layout, campos, tags, templates).

---

## 2. ESTRUTURA DE ARQUIVOS

```
src/
├── App.tsx                          # Providers + roteamento raiz
├── main.tsx                         # Entry point
├── index.css                        # Estilos globais + variáveis CSS
│
├── pages/
│   ├── Index.tsx                    # Página principal (atividades + notas + dashboard)
│   ├── Auth.tsx                     # Login / Cadastro / Recuperar senha
│   └── NotFound.tsx                 # 404
│
├── components/
│   ├── activities/                  # Módulo de atividades
│   │   ├── ActivityList.tsx         # ★ Lista principal (57KB) — cards/tabela, filtros, drag
│   │   ├── ActivityItem.tsx         # Item individual (card ou linha de tabela)
│   │   ├── ActivityDetail.tsx       # Dialog de detalhe completo
│   │   ├── ActivityCreateDialog.tsx # Dialog de criação (simples ou detalhado)
│   │   ├── ActivitySchedule.tsx     # UI de agendamento / recorrência / bucket
│   │   ├── ActivityDependencyField.tsx  # Campo de dependências
│   │   ├── ActivityFormLayoutBlocks.tsx # Visualização do grid do form
│   │   └── ActivityVisualTest.tsx   # Componente de testes visuais (dev)
│   │
│   ├── notes/                       # Módulo de anotações
│   │   ├── NewVisualNotesWorkspace.tsx  # ★ Workspace principal (44KB)
│   │   ├── NoteEditor.tsx           # Editor de linhas (27KB) — undo/redo, tipos
│   │   ├── NoteLine.tsx             # Linha individual renderizada
│   │   ├── NotesSidebar.tsx         # Navegação por data (calendário)
│   │   ├── NotesList.tsx            # Lista de notas disponíveis
│   │   └── NoteFormattingHints.tsx  # Dicas de formatação
│   │
│   ├── settings/                    # Módulo de configurações
│   │   ├── SettingsPanel.tsx        # Dialog principal (abas: geral, aparência, layout...)
│   │   ├── NewVisualSettingsDialog.tsx  # Versão novo visual
│   │   ├── AppearanceSettings.tsx   # Fonte, tamanho, cor, tema
│   │   ├── LayoutSettings.tsx       # Visibilidade e tamanho dos painéis
│   │   ├── ListDisplaySettings.tsx  # Opções da lista (cards/tabela, campos visíveis)
│   │   ├── TableVisualSettings.tsx  # Configurações específicas da tabela
│   │   ├── ActivityFormLayoutSettings.tsx  # Grid drag-to-arrange do form
│   │   ├── NoteTemplateSettings.tsx # Gerenciar templates de notas
│   │   └── NoteShortcutsSettings.tsx # Referência de atalhos
│   │
│   ├── layout/
│   │   ├── AppTopBar.tsx            # Barra de topo (logo, abas, menu usuário)
│   │   ├── MobileLayout.tsx         # Layout mobile (< 768px)
│   │   ├── TabletLayout.tsx         # Layout tablet (768–1024px)
│   │   ├── LayoutModeSelector.tsx   # Toggle mobile/desktop
│   │   └── AppVisualModeSelector.tsx # Toggle visual atual/novo
│   │
│   ├── dashboard/
│   │   └── DashboardOverview.tsx    # Cards de estatísticas + destaques
│   │
│   ├── brand/
│   │   └── Brand.tsx                # Logo SVG com gradiente
│   │
│   ├── ui/                          # shadcn/ui — 60+ componentes prontos
│   │   └── (button, card, dialog, input, select, tabs, table, toast, etc.)
│   │
│   ├── NavLink.tsx                  # Link de navegação
│   └── UnsavedChangesDialog.tsx     # Dialog de confirmação de descarte
│
├── hooks/
│   ├── useAuth.ts                   # Autenticação (sign in/up/out, reset password)
│   ├── useActivities.ts             # CRUD de atividades + fila offline
│   ├── useNotes.ts                  # CRUD de notas + undo/redo + autosave
│   ├── useSettings.ts               # CRUD de configurações + campos + tags
│   ├── useAppearance.ts             # Tema, fonte, modo — aplica CSS vars
│   ├── useLocalStorage.ts           # Wrapper de localStorage
│   ├── use-mobile.tsx               # Detecção de mobile
│   └── use-toast.ts                 # Hook de toast
│
├── contexts/
│   ├── AuthContext.tsx              # user, isLoading, isAuthenticated + métodos auth
│   └── AppearanceContext.tsx        # appearance, updateAppearance, setPreviewAppearance
│
├── lib/
│   ├── activity-meta.ts             # Helpers de metadados (bucket, recorrência, deps)
│   ├── activity-schedule.ts         # Cálculo de próxima data de recorrência
│   ├── activity-form-layout.ts      # Definições de grid do form
│   ├── user-settings.ts             # Persistência e normalização de settings
│   ├── note-templates.ts            # Templates padrão e serialização
│   ├── custom-fields.ts             # Deduplicação e validação de campos
│   ├── note-shortcuts.ts            # Definições de atalhos de teclado
│   ├── date.ts                      # Utilitários de data (timezone BR)
│   ├── brand.ts                     # Constantes de marca
│   └── utils.ts                     # clsx, tailwind-merge e utilitários gerais
│
├── types/
│   └── index.ts                     # ★ Todos os tipos TypeScript do sistema
│
├── integrations/supabase/
│   ├── client.ts                    # Inicialização do cliente Supabase
│   └── types.ts                     # Tipos gerados pelo banco (tabelas/queries)
│
└── test/
    └── setup.ts                     # Configuração do Vitest
```

---

## 3. ROTEAMENTO

O app usa React Router v6. Há **uma única rota** (`/`). A exibição depende do estado de auth:

| Estado | Componente renderizado |
|--------|------------------------|
| Não autenticado | `Auth.tsx` (login/cadastro/reset) |
| Autenticado | `Index.tsx` (workspace completo) |

`Index.tsx` renderiza layouts diferentes com base no tamanho de tela:
- Mobile → `MobileLayout`
- Tablet → `TabletLayout`
- Desktop → layout de painéis redimensionáveis inline

---

## 4. MÓDULO DE ATIVIDADES

### Conceitos
| Conceito | Descrição |
|----------|-----------|
| **Bucket** | Categorização temporal: `inbox`, `today`, `upcoming`, `someday` |
| **Status** | `open` ou `done` |
| **Campos customizados** | Definidos pelo usuário; armazenados em `activity.customFields` (objeto chave→valor) |
| **Chaves de sistema** | Prefixo `system_` dentro de `customFields` (ver lista abaixo) |
| **Tags** | Array de strings (`activity.tags`) |
| **Recorrência** | Objeto `ActivityRecurrence` com frequência e próxima data |

### Chaves de sistema em `customFields`
```
system_bucket           → 'inbox' | 'today' | 'upcoming' | 'someday'
system_scheduledDate    → string ISO date (due date)
system_project          → string
system_area             → string
system_nextAction       → string
system_blockedBy        → string[] (IDs de atividades bloqueantes)
system_predecessors     → string[] (IDs de predecessores)
system_successors       → string[] (IDs de sucessores)
system_subtasks         → ActivitySubtask[]
system_recurrence       → ActivityRecurrence
system_linkedNoteDates  → string[] (datas de notas vinculadas)
system_sourceLineIds    → string[] (IDs de linhas de nota que geraram esta atividade)
system_favorite         → boolean
system_reviewAt         → string ISO date
```

### Campos protegidos (built-in, não removíveis)
- **Due Date** (`system_scheduledDate`)
- **Priority** — gerenciado separadamente em `activity-meta.ts`

### Modos de exibição da lista
- **Cards** — modo padrão com cartões visuais
- **Tabela** — modo compacto com colunas configuráveis

### Componente principal: `ActivityList.tsx`
É o maior arquivo do sistema (57KB, ~1400 linhas). Gerencia:
- Renderização em cards ou tabela
- Seleção múltipla (bulk)
- Drag-to-reorder (dnd-kit)
- Filtros (por tag, campo, status)
- Ordenação (manual, data, prioridade, criação)
- Abertura de dialog de detalhe/criação

---

## 5. MÓDULO DE NOTAS

### Conceitos
- **Uma nota por dia** — chave = `YYYY-MM-DD`
- **Linhas** — cada nota é uma lista de `NoteLine`
- **Tipos de linha:**

| Tipo | Markdown-like | Descrição |
|------|--------------|-----------|
| `paragraph` | (padrão) | Texto normal |
| `title` | `# ` | Título grande |
| `subtitle` | `## ` | Subtítulo |
| `bullet` | `- ` | Item de lista |
| `quote` | `> ` | Citação/destaque |
| `comment` | `// ` | Comentário/obs |

- **Indentação** — propriedade `indent` (número inteiro ≥ 0)
- **Colapso** — propriedade `collapsed` para ocultar sub-itens

### Funcionalidades especiais
- **Undo/redo** — histórico local (não persiste no banco)
- **Autosave** — debounced, configurável em settings
- **Templates** — estruturas pré-definidas para tipos de nota (reunião, diário, etc.)
- **Busca** — busca cross-date em todas as notas
- **Criar atividade a partir de linha** — converte linha de nota em atividade

### Componente principal: `NewVisualNotesWorkspace.tsx`
44KB. Orquestra toda a UX do módulo de notas: barra de ferramentas de formatação, navegação por data, ações de template, integração com o editor.

---

## 6. SISTEMA DE CONFIGURAÇÕES

### Organização das Settings
```typescript
AppSettings {
  customFields: CustomField[]           // Campos criados pelo usuário
  tags: Tag[]                           // Tags disponíveis
  noteTemplates: NoteTemplate[]         // Templates de nota
  appVisualMode: 'current' | 'new'      // Modo visual do app
  allowReopenCompleted: boolean         // Permite reabrir atividades concluídas
  defaultSort: SortOption               // Ordenação padrão
  activityCreationMode: 'simple' | 'detailed'
  autosaveEnabled: boolean
  noteDateButtonsEnabled: boolean
  quickRescheduleDaysThreshold: number
  layout: LayoutSettings
  listDisplay: ActivityListDisplaySettings
  savedFilters: FilterConfig[]
  savedSort: SortConfig
}
```

### Configurações de aparência (separadas)
```typescript
AppearanceSettings {
  fontFamily: 'inter' | 'system' | 'roboto' | 'opensans' | 'poppins'
  fontSize: 'small' | 'medium' | 'large'
  colorTheme: 'amber' | 'blue' | 'green' | 'purple' | 'pink'
  themeMode: 'light' | 'dark' | 'system'
  mobileLayoutMode: 'mobile' | 'desktop'
  noteLineSpacing: number  // 0–100
}
```

### Configurações de layout
```typescript
LayoutSettings {
  showTabs: boolean
  showNotes: boolean
  showNotesList: boolean
  showActivities: boolean
  desktopMainPanelSize: number
  desktopNotesListPanelSize: number
  tabletNotesPanelSize: number
}
```

---

## 7. GERENCIAMENTO DE ESTADO

| Camada | O que gerencia |
|--------|---------------|
| `AuthContext` | Usuário autenticado, `isLoading`, `isAuthenticated` |
| `AppearanceContext` | Tema visual; aplica CSS vars ao documento |
| `useActivities` | CRUD de atividades + fila de operações pendentes (offline) |
| `useNotes` | CRUD de notas + histórico undo/redo + estado de rascunho |
| `useSettings` | CRUD de settings, campos, tags |
| `useAppearance` | Lógica de tema — calcula e aplica variáveis CSS |
| React Query | Cache de estado do servidor (staleTime: 5min) |
| localStorage | Fallback offline: pendingOps, settings, templates, aparência |

**Fluxo de persistência:**
1. Mudança local → estado React (imediato)
2. Debounce/throttle → salva em localStorage (backup)
3. Sync → Supabase (async, com fila de pendentes se offline)

---

## 8. SISTEMA DE TIPOS

**Arquivo único:** `src/types/index.ts`

Tipos principais:
- `Activity` — entidade de tarefa
- `ActivityBucket` — enum de bucket
- `ActivityRecurrence` — configuração de recorrência
- `ActivitySubtask` — subtarefa
- `NoteLine` — linha de nota
- `LineType` — tipos de linha
- `DailyNote` — nota de um dia
- `NoteTemplate` — template de nota
- `CustomField` — definição de campo customizado
- `FieldType` — tipos de campo
- `Tag` — tag com cor
- `AppSettings` — configurações gerais
- `AppearanceSettings` — configurações visuais
- `LayoutSettings` — layout dos painéis
- `FilterConfig` — configuração de filtro
- `SortConfig` — configuração de ordenação

---

## 9. TEMA E ESTILOS

### Abordagem
- **Tailwind CSS** para todas as classes utilitárias
- **CSS custom properties** para o sistema de temas (definidas em `src/index.css`)
- **`clsx` + `tailwind-merge`** (via `cn()` em `lib/utils.ts`) para composição de classes
- Sem CSS modules — tudo via className

### Variáveis CSS principais (light mode)
```css
--background: 40 20% 98%        /* Off-white quente */
--foreground: 30 10% 15%        /* Texto marrom escuro */
--primary: 35 90% 50%           /* Âmbar (#F4B544) */
--secondary: 35 15% 94%         /* Bege claro */
--accent: 35 80% 55%            /* Âmbar brilhante */
--border: 35 15% 88%            /* Borda sutil */
--muted: 35 10% 93%             /* Texto/fundo muted */

/* Notas */
--editor-title: 30 10% 10%
--editor-subtitle: 30 10% 25%
--editor-quote: 35 60% 45%
--note-line-height-heading: 1.07
--note-line-height-paragraph: 1.33
```

### Temas de cor disponíveis
`amber` (padrão) | `blue` | `green` | `purple` | `pink`

### Modos
`light` | `dark` | `system` — gerenciado por `next-themes`

---

## 10. BANCO DE DADOS (SUPABASE)

**Projeto:** `rezbeuxknwdykpphomcq.supabase.co`

### Tabelas
| Tabela | Propósito |
|--------|-----------|
| `activities` | Atividades/tarefas |
| `notes` | Registros de notas diárias |
| `note_lines` | Linhas individuais de notas |
| `custom_fields` | Definições de campos customizados |
| `tags` | Tags disponíveis |
| `profiles` | Perfis de usuários |
| `user_settings` | Preferências do usuário |

**Cliente:** `src/integrations/supabase/client.ts`  
**Tipos gerados:** `src/integrations/supabase/types.ts`

---

## 11. AUTENTICAÇÃO

- Sistema local (username/password via Supabase Auth)
- **Recuperação de senha** via pergunta de segurança (3 passos: informar user → responder pergunta → definir nova senha)
- **Ao criar conta:** dados padrão são criados automaticamente (campos, tags, templates)
- Hook: `useAuth.ts` | Contexto: `AuthContext.tsx` | Página: `Auth.tsx`

---

## 12. RESPONSIVIDADE / LAYOUTS

| Breakpoint | Layout | Componente |
|-----------|--------|-----------|
| < 768px | Mobile — seção única fullscreen | `MobileLayout.tsx` |
| 768–1024px | Tablet — dois painéis (notes + activities) | `TabletLayout.tsx` |
| > 1024px | Desktop — três painéis redimensionáveis | Inline em `Index.tsx` |

O usuário pode forçar modo desktop no mobile via `mobileLayoutMode` nas configurações.

---

## 13. SCRIPTS E BUILD

```bash
npm run dev          # Dev server em :8080
npm run build        # Build de produção
npm run build:dev    # Build de desenvolvimento
npm run test         # Rodar testes (Vitest)
npm run test:watch   # Testes em modo watch
npm run lint         # ESLint
npm run android:sync # Sincronizar com Capacitor Android
```

---

## 14. GUIA DE ALTERAÇÕES RÁPIDAS

### Quero mudar o visual de um item de atividade
→ `src/components/activities/ActivityItem.tsx`

### Quero mudar como a lista de atividades funciona
→ `src/components/activities/ActivityList.tsx`

### Quero mudar o editor de notas
→ `src/components/notes/NoteEditor.tsx` ou `NewVisualNotesWorkspace.tsx`

### Quero adicionar/mudar uma aba nas configurações
→ `src/components/settings/SettingsPanel.tsx`

### Quero mudar cores/tema
→ `src/index.css` (variáveis CSS) ou `src/hooks/useAppearance.ts`

### Quero adicionar um novo tipo de campo customizado
→ `src/types/index.ts` (adicionar em `FieldType`) + `src/lib/custom-fields.ts` + lógica em `ActivityDetail.tsx`

### Quero mudar a estrutura de dados de uma atividade
→ `src/types/index.ts` (interface `Activity`) + `src/hooks/useActivities.ts` + `src/integrations/supabase/types.ts`

### Quero mudar como o autosave funciona
→ `src/hooks/useNotes.ts`

### Quero mudar o layout dos painéis
→ `src/pages/Index.tsx` + `src/components/settings/LayoutSettings.tsx`

### Quero mudar a barra de topo
→ `src/components/layout/AppTopBar.tsx`

### Quero mudar/adicionar uma rota
→ `src/App.tsx`

### Quero mudar os tipos de linha de nota
→ `src/types/index.ts` (tipo `LineType`) + `src/components/notes/NoteLine.tsx` + `NoteEditor.tsx`

### Quero mudar os templates padrão de nota
→ `src/lib/note-templates.ts`

### Quero mudar as configurações de aparência disponíveis
→ `src/types/index.ts` + `src/components/settings/AppearanceSettings.tsx` + `src/hooks/useAppearance.ts`

---

## 15. PADRÕES DO CÓDIGO

- **Componentes:** Functional components com hooks; nenhum class component
- **Estilização:** `cn(...)` da `lib/utils.ts` para composição de classes Tailwind
- **Formulários:** React Hook Form + Zod para validação
- **Ícones:** `lucide-react` (ex: `<Plus />`, `<Trash2 />`, `<Settings />`)
- **Notificações:** `sonner` via `toast()` para feedback ao usuário
- **Modais:** `Dialog` do Radix UI / shadcn
- **Datas:** `date-fns` + timezone BR (`lib/date.ts`)
- **Sem Redux** — estado via Context + hooks custom
- **Sem styled-components** — tudo Tailwind
