alter table public.user_settings
add column if not exists app_visual_mode text not null default 'current';
