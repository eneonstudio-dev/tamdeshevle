-- Accepted receipt lines become immutable price evidence. Freshness is derived
-- from the purchase time, never from the later review time.
create table if not exists public.receipt_price_history (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.receipt_submissions(id) on delete restrict,
  line_index integer not null check (line_index >= 0),
  submitter_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  chain_id text not null,
  store_id text not null,
  external_store_id text not null,
  store_address text not null,
  product_id text not null,
  unit_price numeric(12,2) not null check (unit_price > 0),
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (submission_id, line_index),
  check (expires_at = observed_at + interval '24 hours')
);

alter table public.receipt_price_history enable row level security;
revoke all on public.receipt_price_history from anon, authenticated;
grant select on public.receipt_price_history to authenticated;

create policy "owners and reviewers can read accepted price history"
on public.receipt_price_history for select to authenticated
using (
  (select auth.uid()) = submitter_id
  or exists (select 1 from public.receipt_reviewers r where r.user_id = (select auth.uid()))
);

create index if not exists receipt_price_history_product_store_observed_idx
on public.receipt_price_history (product_id, store_id, observed_at desc);
create index if not exists receipt_price_history_submitter_observed_idx
on public.receipt_price_history (submitter_id, observed_at desc);
create index if not exists receipt_price_history_reviewer_idx
on public.receipt_price_history (reviewer_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.capture_accepted_receipt_prices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := (select auth.uid());
  scoped boolean;
  external_id text;
begin
  if actor is null or not exists (select 1 from public.receipt_reviewers r where r.user_id = actor) then
    raise exception 'receipt acceptance requires reviewer membership' using errcode = '42501';
  end if;
  if new.status <> 'accepted' or old.status = 'accepted' then return new; end if;

  scoped := coalesce((new.payload #>> '{verification,store_scope_verified}')::boolean, false);
  external_id := nullif(btrim(new.payload #>> '{store,external_store_id}'), '');
  if not scoped or external_id is null then
    raise exception 'accepted receipt must have verified exact-store scope' using errcode = '23514';
  end if;

  insert into public.receipt_price_history (
    submission_id, line_index, submitter_id, reviewer_id, chain_id, store_id,
    external_store_id, store_address, product_id, unit_price, observed_at, expires_at
  )
  select new.id, line.line_index, new.user_id, actor, new.chain_id, new.store_id,
    external_id, new.store_address, line.product_id, line.unit_price, new.observed_at,
    new.observed_at + interval '24 hours'
  from public.receipt_review_lines line
  where line.submission_id = new.id and line.decision = 'accepted'
    and line.product_id is not null and line.unit_price > 0
  on conflict (submission_id, line_index) do nothing;

  if not found then
    raise exception 'accepted receipt must contain at least one accepted valid line' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.capture_accepted_receipt_prices() from public, anon, authenticated;
drop trigger if exists capture_accepted_receipt_prices on public.receipt_submissions;
create trigger capture_accepted_receipt_prices
after update of status on public.receipt_submissions
for each row
when (new.status = 'accepted' and old.status is distinct from new.status)
execute function private.capture_accepted_receipt_prices();
