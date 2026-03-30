alter table public.user_settings
  add column if not exists note_templates jsonb;
