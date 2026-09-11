create table if not exists public.savings_ledger (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  occurred_at timestamptz not null default now(),
  store_id text not null,
  store_name text not null,
  channel text not null check (channel in ('shelf','bring','delivery_catalog')),
  basket_total integer not null check (basket_total > 0),
  saving integer not null check (saving > 0),
  cart jsonb not null default '{}'::jsonb,
  verified boolean not null default true check (verified = true),
  unique (user_id, signature)
);
alter table public.savings_ledger enable row level security;
grant select, insert, update, delete on public.savings_ledger to authenticated;
create policy "users read own savings" on public.savings_ledger for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own savings" on public.savings_ledger for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own savings" on public.savings_ledger for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own savings" on public.savings_ledger for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists savings_ledger_user_occurred_idx on public.savings_ledger (user_id, occurred_at desc);
