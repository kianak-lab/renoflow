-- Timeline calendar assignments + public share slug

alter table public.project_room_trades
  add column if not exists calendar_slots jsonb not null default '[]'::jsonb;

comment on column public.project_room_trades.calendar_slots is
  'Assigned work days: [{ "date": "YYYY-MM-DD", "duration": "full"|"am"|"pm", "notes": string }]';

alter table public.projects
  add column if not exists calendar_slug text;

alter table public.projects
  add column if not exists calendar_recipients jsonb not null default '[]'::jsonb;

alter table public.projects
  add column if not exists calendar_my_google_enabled boolean not null default false;

comment on column public.projects.calendar_slug is 'Unique public slug for /cal/[slug] read-only schedule.';
comment on column public.projects.calendar_recipients is 'Invite list: [{ name, email, role, enabled }]';

create unique index if not exists projects_calendar_slug_key
  on public.projects (calendar_slug)
  where calendar_slug is not null and length(trim(calendar_slug)) > 0;

alter table public.profiles
  add column if not exists google_calendar_refresh_token text,
  add column if not exists google_calendar_email text;

comment on column public.profiles.google_calendar_refresh_token is 'OAuth refresh token for Google Calendar API (server-only).';
