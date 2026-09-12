-- Bai Learning Backend v1 schema draft.
-- Apply only from a trusted server/admin context after a Supabase project is connected.
-- No browser client gets direct table access. actor_hash must be derived server-side.

create table if not exists public.bai_learning_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{32,128}$'),
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
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{32,128}$'),
  intent_key text not null check (intent_key ~ '^[a-f0-9]{8,64}$'),
  variant_key text not null check (variant_key ~ '^[a-f0-9]{8,64}$'),
  input_sanitized text not null check (length(input_sanitized) between 1 and 220),
  correction_sanitized text not null default '' check (length(correction_sanitized) <= 220),
  operations jsonb not null check (jsonb_typeof(operations) = 'array' and jsonb_array_length(operations) between 1 and 12),
  server_score smallint not null check (server_score between 0 and 100),
  reasons text[] not null default '{}'
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
create index if not exists bai_learning_quarantine_intent_idx on public.bai_learning_quarantine(intent_key, created_at desc);

alter table public.bai_learning_events enable row level security;
alter table public.bai_learning_quarantine enable row level security;
alter table public.bai_approved_patterns enable row level security;

-- Defense in depth: browser roles cannot read or write learning data directly.
revoke all on table public.bai_learning_events from anon, authenticated;
revoke all on table public.bai_learning_quarantine from anon, authenticated;
revoke all on table public.bai_approved_patterns from anon, authenticated;

-- Server-only access. Never expose the service role / secret key in the frontend.
grant select, insert, update, delete on table public.bai_learning_events to service_role;
grant select, insert, update, delete on table public.bai_learning_quarantine to service_role;
grant select, insert, update, delete on table public.bai_approved_patterns to service_role;
grant usage, select on all sequences in schema public to service_role;
