-- Bai Learning Backend v1 schema.
-- Browser roles have no direct access. All writes go through the server-side ingest function.
-- actor_hash is derived server-side from an authenticated user id; raw user ids are never stored here.

create table if not exists public.bai_learning_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  intent_key text not null check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  client_fingerprint text not null default '' check (length(client_fingerprint) <= 64),
  input_sanitized text not null check (length(input_sanitized) between 1 and 220),
  correction_sanitized text not null default '' check (length(correction_sanitized) <= 220),
  operations jsonb not null check (jsonb_typeof(operations) = 'array' and jsonb_array_length(operations) between 1 and 12),
  server_score smallint not null check (server_score between 0 and 100),
  reasons text[] not null default '{}',
  unique (actor_hash, variant_key)
);

create table if not exists public.bai_learning_quarantine (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  intent_key text not null check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  input_sanitized text not null check (length(input_sanitized) between 1 and 220),
  correction_sanitized text not null default '' check (length(correction_sanitized) <= 220),
  operations jsonb not null check (jsonb_typeof(operations) = 'array' and jsonb_array_length(operations) between 0 and 12),
  server_score smallint not null check (server_score between 0 and 100),
  reasons text[] not null default '{}'
);

create table if not exists public.bai_learning_review_queue (
  intent_key text primary key check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  independent_actors integer not null check (independent_actors >= 1),
  median_score smallint not null check (median_score between 0 and 100),
  conflict_actors integer not null default 0 check (conflict_actors >= 0),
  actor_share numeric(5,4) not null check (actor_share between 0 and 1),
  observation_span_ms bigint not null default 0 check (observation_span_ms >= 0),
  status text not null check (status in ('review_ready','approval_eligible')),
  requires_regression boolean not null default true check (requires_regression = true),
  updated_at timestamptz not null default now()
);

create table if not exists public.bai_approved_patterns (
  intent_key text primary key check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  input_sanitized text not null check (length(input_sanitized) between 1 and 220),
  correction_sanitized text not null default '' check (length(correction_sanitized) <= 220),
  operations jsonb not null check (jsonb_typeof(operations) = 'array' and jsonb_array_length(operations) between 1 and 12),
  independent_actors integer not null check (independent_actors >= 4),
  median_score smallint not null check (median_score between 85 and 100),
  regression_ref text not null check (length(regression_ref) between 1 and 200),
  approved_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists bai_learning_events_intent_idx on public.bai_learning_events(intent_key, created_at desc);
create index if not exists bai_learning_events_actor_time_idx on public.bai_learning_events(actor_hash, created_at desc);
create index if not exists bai_learning_quarantine_actor_time_idx on public.bai_learning_quarantine(actor_hash, created_at desc);

alter table public.bai_learning_events enable row level security;
alter table public.bai_learning_quarantine enable row level security;
alter table public.bai_learning_review_queue enable row level security;
alter table public.bai_approved_patterns enable row level security;

-- Deny browser roles at the grant layer as well as RLS. No browser policies are intentionally created.
revoke all on table public.bai_learning_events from public, anon, authenticated;
revoke all on table public.bai_learning_quarantine from public, anon, authenticated;
revoke all on table public.bai_learning_review_queue from public, anon, authenticated;
revoke all on table public.bai_approved_patterns from public, anon, authenticated;
revoke all on sequence public.bai_learning_events_id_seq from public, anon, authenticated;
revoke all on sequence public.bai_learning_quarantine_id_seq from public, anon, authenticated;

-- Edge Function only. Never expose the service role / secret key in the frontend.
grant select, insert, update, delete on table public.bai_learning_events to service_role;
grant select, insert, update, delete on table public.bai_learning_quarantine to service_role;
grant select, insert, update, delete on table public.bai_learning_review_queue to service_role;
grant select, insert, update, delete on table public.bai_approved_patterns to service_role;
grant usage, select on sequence public.bai_learning_events_id_seq to service_role;
grant usage, select on sequence public.bai_learning_quarantine_id_seq to service_role;
