alter table public.profiles add column if not exists currency text;
alter table public.profiles add column if not exists measurement_units text;

comment on column public.profiles.currency is 'ISO currency hint from onboarding (e.g. CAD, USD).';
comment on column public.profiles.measurement_units is 'imperial | metric from onboarding.';
