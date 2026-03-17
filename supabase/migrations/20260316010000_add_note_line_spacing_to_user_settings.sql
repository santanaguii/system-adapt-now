alter table public.user_settings
add column if not exists note_line_spacing text not null default '50';
