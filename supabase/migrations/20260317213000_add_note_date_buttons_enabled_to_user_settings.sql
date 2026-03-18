alter table public.user_settings
add column if not exists note_date_buttons_enabled boolean not null default true;
