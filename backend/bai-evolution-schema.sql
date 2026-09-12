create table if not exists public.bai_evolution_runs (
  id uuid primary key default gen_random_uuid(),
  baseline_version text not null check (char_length(baseline_version) between 1 and 80),
  candidate_version text not null check (char_length(candidate_version) between 1 and 80),
  model text not null default 'unknown' check (char_length(model) between 1 and 120),
  baseline_score numeric(5,1) not null check (baseline_score between 0 and 100),
  candidate_score numeric(5,1) not null check (candidate_score between 0 and 100),
  baseline_pass_rate numeric(5,1) not null check (baseline_pass_rate between 0 and 100),
  candidate_pass_rate numeric(5,1) not null check (candidate_pass_rate between 0 and 100),
  critical_failures integer not null default 0 check (critical_failures >= 0),
  eligible boolean not null default false,
  requires_canary boolean not null default true,
  auto_promote boolean not null default false check (auto_promote = false),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bai_evolution_runs_created_idx on public.bai_evolution_runs(created_at desc);

alter table public.bai_evolution_runs enable row level security;
revoke all on table public.bai_evolution_runs from public, anon, authenticated;
grant select, insert on table public.bai_evolution_runs to service_role;

comment on table public.bai_evolution_runs is 'Server-only Bai evolution metrics. No raw conversations or basket payloads.';
