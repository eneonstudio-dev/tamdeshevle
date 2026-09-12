-- Bai Learning Admin v1 add-on schema.
-- Apply after bai-learning-supabase-schema.sql.
-- Browser roles intentionally receive no access; only Edge Functions use service_role.

create table if not exists public.bai_learning_admin_decisions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_actor_hash text not null check (admin_actor_hash ~ '^[a-f0-9]{64}$'),
  intent_key text not null check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  decision text not null check (decision in ('approved_for_regression','rejected','reopened')),
  note text not null default '' check (length(note) <= 300),
  queue_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists bai_learning_admin_decisions_intent_idx
on public.bai_learning_admin_decisions(intent_key, created_at desc);

alter table public.bai_learning_admin_decisions enable row level security;
revoke all on table public.bai_learning_admin_decisions from public, anon, authenticated;
revoke all on sequence public.bai_learning_admin_decisions_id_seq from public, anon, authenticated;

grant select, insert, update, delete on table public.bai_learning_admin_decisions to service_role;
grant usage, select on sequence public.bai_learning_admin_decisions_id_seq to service_role;
