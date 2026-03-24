alter table public.user_settings
add column if not exists layout_settings jsonb not null default '{}'::jsonb;
