-- Product cache for Home Depot / supplier search results
create table if not exists public.cached_products (
  id uuid primary key default gen_random_uuid(),
  trade text,
  subsection text,
  search_term text,
  title text,
  brand text,
  thumbnail text,
  price text,
  model_number text,
  sku text,
  fetched_at timestamptz
);

comment on table public.cached_products is 'Cached supplier product rows (e.g. SerpAPI) keyed by app context.';

alter table public.cached_products enable row level security;

-- Authenticated users (JWT role = authenticated) can read every row
create policy "cached_products_select_authenticated"
  on public.cached_products
  for select
  to authenticated
  using (true);

grant select on table public.cached_products to authenticated;
