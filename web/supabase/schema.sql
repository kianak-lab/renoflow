-- RenoFlow core schema
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text default 'Your Company',
  company_phone text,
  company_email text,
  company_license text,
  company_address text,
  company_logo_url text,
  company_theme_color text,
  default_markup_percent numeric(6,2) not null default 20,
  default_tax_percent numeric(6,2) not null default 13,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Renovation',
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  address text,
  quote_number text not null default 'Q-001',
  notes text default 'All prices include labour and materials. HST extra. 50% deposit required.',
  start_date date,
  deadline_date date,
  parallel_rooms boolean not null default false,
  include_timeline boolean not null default true,
  markup_percent numeric(6,2) not null default 20,
  tax_percent numeric(6,2) not null default 13,
  invoice_sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
/** Soft-hide from active lists; run once on existing DBs. */
alter table public.projects add column if not exists archived boolean not null default false;
create index if not exists projects_user_id_idx on public.projects(user_id);

create table if not exists public.trade_catalog (
  id text primary key,
  label text not null,
  icon text,
  color_hex text,
  sort_order integer not null default 0
);

create table if not exists public.trade_catalog_items (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null references public.trade_catalog(id) on delete cascade,
  code text not null,
  label text not null,
  unit text not null,
  unit_price numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  unique (trade_id, code)
);

create table if not exists public.trade_catalog_fixtures (
  id uuid primary key default gen_random_uuid(),
  trade_id text not null references public.trade_catalog(id) on delete cascade,
  code text not null,
  label text not null,
  icon text,
  unit text not null,
  unit_price numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  unique (trade_id, code)
);

create table if not exists public.room_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text,
  sort_order integer not null default 0
);

create table if not exists public.room_template_trades (
  room_template_id uuid not null references public.room_templates(id) on delete cascade,
  trade_id text not null references public.trade_catalog(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (room_template_id, trade_id)
);

create table if not exists public.project_rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  room_template_id uuid references public.room_templates(id) on delete set null,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_rooms_project_id_idx on public.project_rooms(project_id);

create table if not exists public.project_room_trades (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.project_rooms(id) on delete cascade,
  trade_id text not null references public.trade_catalog(id) on delete restrict,
  display_name text not null,
  note text not null default '',
  is_open boolean not null default false,
  days integer not null default 0,
  days_custom boolean not null default false,
  sort_order integer not null default 0,
  unique (room_id, trade_id)
);
create index if not exists project_room_trades_room_id_idx on public.project_room_trades(room_id);

create table if not exists public.project_trade_items (
  id uuid primary key default gen_random_uuid(),
  room_trade_id uuid not null references public.project_room_trades(id) on delete cascade,
  code text not null,
  label text not null,
  unit text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 0,
  was_auto boolean not null default false,
  sort_order integer not null default 0
);
create index if not exists project_trade_items_room_trade_id_idx on public.project_trade_items(room_trade_id);

create table if not exists public.project_trade_fixtures (
  id uuid primary key default gen_random_uuid(),
  room_trade_id uuid not null references public.project_room_trades(id) on delete cascade,
  group_key text not null default 'default',
  code text not null,
  label text not null,
  icon text,
  unit text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 0,
  sort_order integer not null default 0
);
create index if not exists project_trade_fixtures_room_trade_id_idx on public.project_trade_fixtures(room_trade_id);

create table if not exists public.material_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  material_key text not null,
  checked boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists material_checklist_user_project_material_uidx
  on public.material_checklist (user_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), material_key);

create table if not exists public.custom_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id text not null references public.trade_catalog(id) on delete cascade,
  icon text,
  name text not null,
  unit text not null,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists custom_materials_user_trade_idx on public.custom_materials(user_id, trade_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  project_name text,
  client_name text,
  client_email text,
  client_phone text,
  client_address text,
  terms_code text not null default 'net7',
  created_date date not null default current_date,
  sent_date date,
  paid boolean not null default false,
  void boolean not null default false,
  deposit_amount numeric(12,2) not null default 0,
  deposit_paid boolean not null default false,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(6,2) not null default 13,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  company_name text,
  company_phone text,
  company_email text,
  company_address text,
  company_license text,
  room_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, invoice_number)
);
create index if not exists invoices_project_id_idx on public.invoices(project_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_clients on public.clients;
create trigger set_updated_at_clients before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_projects on public.projects;
create trigger set_updated_at_projects before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_rooms on public.project_rooms;
create trigger set_updated_at_rooms before update on public.project_rooms
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_invoices on public.invoices;
create trigger set_updated_at_invoices before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.projects add column if not exists deadline_date date;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_rooms enable row level security;
alter table public.project_room_trades enable row level security;
alter table public.project_trade_items enable row level security;
alter table public.project_trade_fixtures enable row level security;
alter table public.material_checklist enable row level security;
alter table public.custom_materials enable row level security;
alter table public.invoices enable row level security;

create policy "profiles owner read/write" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "clients owner read/write" on public.clients;
drop policy if exists "clients select own" on public.clients;
drop policy if exists "clients insert own" on public.clients;
drop policy if exists "clients update own" on public.clients;
drop policy if exists "clients delete own" on public.clients;

create policy "clients select own" on public.clients
for select using (auth.uid() = user_id);

create policy "clients insert own" on public.clients
for insert with check (auth.uid() = user_id);

create policy "clients update own" on public.clients
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "clients delete own" on public.clients
for delete using (auth.uid() = user_id);

create policy "projects owner read/write" on public.projects
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rooms by project owner" on public.project_rooms
for all using (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

create policy "room trades by room owner" on public.project_room_trades
for all using (
  exists (
    select 1
    from public.project_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.project_rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id and p.user_id = auth.uid()
  )
);

create policy "trade items by room trade owner" on public.project_trade_items
for all using (
  exists (
    select 1
    from public.project_room_trades rt
    join public.project_rooms r on r.id = rt.room_id
    join public.projects p on p.id = r.project_id
    where rt.id = room_trade_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.project_room_trades rt
    join public.project_rooms r on r.id = rt.room_id
    join public.projects p on p.id = r.project_id
    where rt.id = room_trade_id and p.user_id = auth.uid()
  )
);

create policy "trade fixtures by room trade owner" on public.project_trade_fixtures
for all using (
  exists (
    select 1
    from public.project_room_trades rt
    join public.project_rooms r on r.id = rt.room_id
    join public.projects p on p.id = r.project_id
    where rt.id = room_trade_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.project_room_trades rt
    join public.project_rooms r on r.id = rt.room_id
    join public.projects p on p.id = r.project_id
    where rt.id = room_trade_id and p.user_id = auth.uid()
  )
);

create policy "material checklist owner read/write" on public.material_checklist
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "custom materials owner read/write" on public.custom_materials
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoices by project owner" on public.invoices
for all using (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()
  )
);

-- Trade rows referenced by project_room_trades.trade_id (RenoFlow UI slugs)
insert into public.trade_catalog (id, label, sort_order) values
  ('demo', 'Demolition', 10),
  ('framing', 'Framing', 20),
  ('concrete', 'Concrete', 22),
  ('roofing', 'Roofing', 24),
  ('electrical', 'Electrical', 30),
  ('plumbing', 'Plumbing', 40),
  ('hvac', 'HVAC', 50),
  ('lowvolt', 'Low voltage', 55),
  ('security', 'Security', 56),
  ('comdoor', 'Commercial door hardware', 57),
  ('insulation', 'Insulation', 60),
  ('drywall', 'Drywall', 70),
  ('tile', 'Tile', 80),
  ('flooring', 'Flooring', 90),
  ('painting', 'Painting', 100),
  ('trim', 'Trim & Millwork', 110),
  ('cabinets', 'Cabinets', 120),
  ('closets', 'Closets', 125),
  ('finishing', 'Finishing', 130)
on conflict (id) do nothing;

-- Shareable client intake links (public form → saves client on contractor's account)
create table if not exists public.client_intake_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists client_intake_links_token_idx on public.client_intake_links(token);
create index if not exists client_intake_links_user_id_idx on public.client_intake_links(user_id);

-- Onboarding (see migrations/002_onboarding_profile_columns.sql for incremental deploys)
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists region_code text;
alter table public.profiles add column if not exists company_city text;
alter table public.profiles add column if not exists company_postal text;
alter table public.profiles add column if not exists tax_id text;
alter table public.profiles add column if not exists selected_trades jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists default_labour_mode text;
alter table public.profiles add column if not exists default_labour_rate numeric(12, 2);

create or replace view public.user_profiles as
  select p.*, p.id as user_id from public.profiles p;
