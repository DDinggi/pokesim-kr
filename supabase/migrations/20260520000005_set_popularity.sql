-- Aggregate set popularity for the box picker.
-- Rolling 24h window so the list reflects recent activity, not lifetime totals
-- (older sets would otherwise stay pinned forever).
-- RLS still blocks direct SELECT on sim_events; clients only call this aggregate RPC.

create or replace function public.get_set_popularity()
returns table (
  set_code text,
  total_boxes bigint,
  total_packs bigint,
  total_krw bigint,
  total_sessions bigint
)
language sql
security definer
set search_path = public
as $$
  select
    sim_events.set_code,
    coalesce(sum(sim_events.box_count), 0)::bigint as total_boxes,
    coalesce(sum(sim_events.pack_count), 0)::bigint as total_packs,
    coalesce(sum(sim_events.krw), 0)::bigint as total_krw,
    count(distinct sim_events.session_id)::bigint as total_sessions
  from public.sim_events
  where sim_events.set_code is not null
    and sim_events.created_at >= now() - interval '24 hours'
  group by sim_events.set_code
  order by total_boxes desc, total_packs desc, total_sessions desc, total_krw desc
  limit 10;
$$;

revoke all on function public.get_set_popularity() from public;
grant execute on function public.get_set_popularity() to anon, authenticated;

create index if not exists idx_sim_events_created_at
  on public.sim_events (created_at desc);

create index if not exists idx_sim_events_popularity_created_set
  on public.sim_events (created_at desc, set_code);
