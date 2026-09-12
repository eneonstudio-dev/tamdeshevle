-- Add a project-wide circuit breaker on top of the per-account limiter so a
-- swarm of accounts cannot consume an unbounded model budget.
create or replace function public.reserve_bai_agent_request(
  p_actor_hash text,
  p_limit integer default 30
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  usage_count integer;
  global_hour_count integer;
  global_day_count integer;
  reservation_id bigint;
begin
  if p_actor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid actor hash' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid request limit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bai-agent-global-v1', 0));
  perform pg_advisory_xact_lock(hashtextextended(p_actor_hash, 0));
  select
    count(*) filter (where created_at >= now() - interval '1 hour'),
    count(*) filter (where created_at >= now() - interval '1 day')
  into global_hour_count, global_day_count
  from public.bai_agent_usage
  where created_at >= now() - interval '1 day';
  if global_hour_count >= 300 or global_day_count >= 2000 then
    return null;
  end if;

  select count(*) into usage_count
  from public.bai_agent_usage
  where actor_hash = p_actor_hash
    and created_at >= now() - interval '1 hour';
  if usage_count >= p_limit then
    return null;
  end if;

  insert into public.bai_agent_usage(actor_hash, outcome, model, latency_ms)
  values (p_actor_hash, 'fallback', null, 0)
  returning id into reservation_id;
  return reservation_id;
end;
$$;

revoke all on function public.reserve_bai_agent_request(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_bai_agent_request(text, integer) to service_role;
