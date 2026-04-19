# System Adapt Now

Aplicacao web/mobile para organizacao de atividades, notas diarias e configuracoes personalizadas por usuario.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Capacitor Android

## Setup local

```sh
npm install
npm run dev
```

O projeto depende das variaveis do `.env` para conectar ao Supabase.

## Validacao local

```sh
npm run test
npm run lint
node .\node_modules\typescript\bin\tsc -p tsconfig.app.json --noEmit
```

Observacao importante:

- `npm run lint` pode ser lento se executado na raiz inteira; durante manutencao prefira `eslint src`.
- O projeto deve permanecer com `tsc --noEmit` limpo antes de publicar.

## Migrations do Supabase

Sempre aplique as migrations antes de testar ou publicar mudancas que usam `user_settings`, `custom_fields`, `notes` ou outras tabelas.

Fluxo recomendado:

```sh
supabase db push
```

Se estiver usando um banco remoto diferente do schema local, valide explicitamente se as colunas abaixo existem em `public.user_settings`:

- `note_date_buttons_enabled`
- `quick_reschedule_days_threshold`
- `layout_settings`
- `app_visual_mode`

As migrations relevantes ficam em:

- `supabase/migrations/20260317213000_add_note_date_buttons_enabled_to_user_settings.sql`
- `supabase/migrations/20260317220000_add_quick_reschedule_days_threshold_to_user_settings.sql`
- `supabase/migrations/20260322120000_add_layout_settings_to_user_settings.sql`
- `supabase/migrations/20260419143000_add_app_visual_mode_to_user_settings.sql`

Sem isso, o frontend pode aparentar salvar configuracoes mas recarregar com valores incorretos por incompatibilidade de schema.

## Deploy

Antes de publicar:

1. Rode testes.
2. Rode lint em `src`.
3. Rode `tsc --noEmit`.
4. Aplique migrations no banco alvo.
5. Se houver alteracoes na funcao de reset de senha, publique a Edge Function.

## Android APK via GitHub Actions

This repository now has a manual workflow to generate an Android APK.

How to run it:

```sh
gh workflow run "Build Android APK" --repo santanaguii/system-adapt-now --ref main -f ref=main
```

Or open GitHub:

- `Actions -> Build Android APK -> Run workflow`

What it does:

- installs dependencies
- builds the Vite app
- syncs the Capacitor Android project
- runs the Gradle debug build
- publishes the APK as a downloadable workflow artifact

## Supabase function

The password recovery flow now depends on the Edge Function in `supabase/functions/reset-password/index.ts`.

Deploy it before testing password reset:

```sh
supabase functions deploy reset-password
```

The function requires `SUPABASE_SERVICE_ROLE_KEY` in the Supabase project secrets because it uses `auth.admin.updateUserById`.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
