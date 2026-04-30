-- Optional flat columns (primary assignments still stored in calendar_slots jsonb)

alter table public.project_room_trades
  add column if not exists scheduled_date date;

alter table public.project_room_trades
  add column if not exists duration text default 'full';

alter table public.project_room_trades
  add column if not exists day_notes text;

comment on column public.project_room_trades.scheduled_date is
  'Optional single-day mirror of assignment; multi-day schedules use calendar_slots.';
