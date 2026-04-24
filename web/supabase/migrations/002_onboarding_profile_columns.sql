-- Onboarding + extended profile (run in Supabase SQL after core schema)
-- user_profiles: mirror view (spec); primary storage remains public.profiles

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles
  add column if not exists country text;
alter table public.profiles
  add column if not exists region_code text;
alter table public.profiles
  add column if not exists company_city text;
alter table public.profiles
  add column if not exists company_postal text;
alter table public.profiles
  add column if not exists tax_id text;
alter table public.profiles
  add column if not exists selected_trades jsonb not null default '[]'::jsonb;
alter table public.profiles
  add column if not exists default_labour_mode text;
alter table public.profiles
  add column if not exists default_labour_rate numeric(12, 2);

-- Optional: data URL or URL string for company logo (large text OK in Postgres)
-- company_logo_url already exists; if storing data URLs only, this is enough.
-- If you need both URL + separate blob name, add company_logo_storage_path later.

-- View for tools / docs that expect "user_profiles"
create or replace view public.user_profiles as
  select
    p.*,
    p.id as user_id
  from public.profiles p;

comment on view public.user_profiles is 'Same row as public.profiles; one row per auth user.';
