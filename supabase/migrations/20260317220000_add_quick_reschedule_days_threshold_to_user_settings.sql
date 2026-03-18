alter table public.user_settings
add column if not exists quick_reschedule_days_threshold integer not null default 0;
