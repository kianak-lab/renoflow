-- Payments + invoice fields for mobile invoice screen (spec 11)

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  method text not null default 'etransfer',
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_project_id_idx on public.payments(project_id);

alter table public.payments enable row level security;

drop policy if exists "users see own payments" on public.payments;
drop policy if exists "payments by invoice project owner" on public.payments;

create policy "payments by invoice project owner" on public.payments
for all using (
  exists (
    select 1
    from public.invoices i
    join public.projects p on p.id = i.project_id
    where i.id = payments.invoice_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.invoices i
    join public.projects p on p.id = i.project_id
    where i.id = payments.invoice_id and p.user_id = auth.uid()
  )
  and auth.uid() = user_id
);

grant select, insert, update, delete on table public.payments to authenticated;

alter table public.invoices add column if not exists amount_paid numeric(12, 2) not null default 0;
alter table public.invoices add column if not exists due_date date;

update public.invoices i
set due_date = coalesce(i.due_date, (i.created_date + interval '7 days')::date)
where i.due_date is null;

notify pgrst, 'reload schema';
