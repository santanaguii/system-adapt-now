

# Plano: Adicionar Configurações de Aparência

## Visão Geral

Vou adicionar uma nova aba "Aparência" nas configurações do sistema onde você poderá personalizar:

- **Tipo de fonte** - Escolher entre diferentes famílias tipográficas
- **Tamanho de fonte** - Ajustar a escala do texto (pequeno, médio, grande)
- **Palheta de cores** - Escolher entre temas de cores predefinidos (âmbar, azul, verde, roxo, rosa)
- **Modo escuro/claro** - Alternar entre light/dark mode

---

## Componentes Visuais

### Nova Aba de Aparência

A aba terá 4 seções:

| Configuração | Opções |
|--------------|--------|
| **Família de Fonte** | Inter (padrão), System UI, Roboto, Open Sans, Poppins |
| **Tamanho de Fonte** | Pequeno (14px), Médio (16px), Grande (18px) |
| **Tema de Cores** | Âmbar (atual), Azul, Verde, Roxo, Rosa |
| **Modo** | Claro, Escuro, Sistema |

### Preview em Tempo Real

As alterações serão aplicadas instantaneamente para você visualizar antes de salvar.

---

## Detalhes Técnicos

### 1. Atualizar Tipos (`src/types/index.ts`)

Adicionar novos tipos para as configurações de aparência:

```typescript
export type FontFamily = 'inter' | 'system' | 'roboto' | 'opensans' | 'poppins';
export type FontSize = 'small' | 'medium' | 'large';
export type ColorTheme = 'amber' | 'blue' | 'green' | 'purple' | 'pink';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppearanceSettings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  colorTheme: ColorTheme;
  themeMode: ThemeMode;
}
```

### 2. Configurar ThemeProvider (`src/App.tsx`)

Integrar `next-themes` (já instalado) para gerenciar light/dark mode:

```typescript
import { ThemeProvider } from 'next-themes';

// Envolver o App com ThemeProvider
<ThemeProvider attribute="class" defaultTheme="system">
  ...
</ThemeProvider>
```

### 3. Criar Hook de Aparência (`src/hooks/useAppearance.ts`)

Novo hook para gerenciar configurações de aparência:

- Carregar/salvar no Supabase (tabela `user_settings`)
- Aplicar CSS custom properties dinamicamente
- Sincronizar com `next-themes` para dark mode

### 4. Atualizar CSS (`src/index.css`)

Adicionar variáveis para:
- Múltiplas palhetas de cores (blue, green, purple, pink)
- Classes de tamanho de fonte
- Importar fontes adicionais do Google Fonts

### 5. Atualizar SettingsPanel (`src/components/settings/SettingsPanel.tsx`)

Adicionar nova aba "Aparência" com:
- Seletor de fonte com preview
- Slider ou botões para tamanho de fonte
- Paleta de cores com preview colorido
- Toggle para modo claro/escuro/sistema

### 6. Migração do Banco de Dados

Adicionar colunas na tabela `user_settings`:
- `font_family` (text, default 'inter')
- `font_size` (text, default 'medium')
- `color_theme` (text, default 'amber')
- `theme_mode` (text, default 'system')

---

## Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/types/index.ts` | Adicionar tipos de aparência |
| `src/App.tsx` | Envolver com ThemeProvider + AppearanceProvider |
| `src/hooks/useAppearance.ts` | **Criar** - Hook para gerenciar aparência |
| `src/index.css` | Adicionar palhetas de cores e fontes |
| `src/components/settings/SettingsPanel.tsx` | Adicionar aba "Aparência" |
| `src/hooks/useSettings.ts` | Integrar configurações de aparência |
| **Migração SQL** | Adicionar colunas em `user_settings` |

---

## Resultado Esperado

Após a implementação, você terá uma nova aba "Aparência" nas configurações com controles visuais para personalizar:

- A fonte usada em todo o sistema
- O tamanho do texto
- As cores principais (botões, links, destaques)
- Alternar entre modo claro e escuro

As preferências serão salvas no banco de dados e aplicadas automaticamente ao fazer login.

