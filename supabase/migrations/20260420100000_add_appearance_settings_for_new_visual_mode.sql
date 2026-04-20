-- Add appearance settings columns for new visual mode
alter table public.user_settings
add column if not exists font_family_new text,
add column if not exists font_size_new text,
add column if not exists color_theme_new text,
add column if not exists theme_mode_new text,
add column if not exists mobile_layout_mode_new text,
add column if not exists note_line_spacing_new text;