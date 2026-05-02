-- Schedule UI: trade completion for timeline progress bars (spec 12)

alter table public.project_room_trades
  add column if not exists completion_percent numeric(5, 2) not null default 0;

comment on column public.project_room_trades.completion_percent is
  '0–100 for timeline progress bar; optional manual or future checklist sync.';

notify pgrst, 'reload schema';
