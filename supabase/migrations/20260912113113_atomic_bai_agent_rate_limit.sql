-- Reserve a paid Bai Agent request under a per-actor transaction lock.
-- Only the server-side service role can execute this function.
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
  reservation_id bigint;
begin
  if p_actor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid actor hash' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid request limit' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor_hash, 0));
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
