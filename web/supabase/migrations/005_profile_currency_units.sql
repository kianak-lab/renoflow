ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS measurement_units text DEFAULT 'imperial';

comment on column public.profiles.currency is 'ISO currency hint from onboarding (e.g. CAD, USD).';
comment on column public.profiles.measurement_units is 'imperial | metric from onboarding.';
