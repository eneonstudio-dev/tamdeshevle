-- Bai Agent Core v1: minimal abuse/cost guard telemetry only.
-- No prompts, messages, basket contents, email, or raw user IDs are persisted here.

create table if not exists public.bai_agent_usage (
  id bigint generated always as identity primary key,
  actor_hash text not null check (char_length(actor_hash) = 64),
  outcome text not null check (outcome in ('ok','fallback','error')),
  model text,
  latency_ms integer not null default 0 check (latency_ms >= 0 and latency_ms <= 120000),
  created_at timestamptz not null default now()
);

create index if not exists bai_agent_usage_actor_created_idx
  on public.bai_agent_usage (actor_hash, created_at desc);

alter table public.bai_agent_usage enable row level security;
revoke all on table public.bai_agent_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.bai_agent_usage to service_role;
revoke all on sequence public.bai_agent_usage_id_seq from public, anon, authenticated;
grant usage, select on sequence public.bai_agent_usage_id_seq to service_role;
