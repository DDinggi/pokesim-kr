-- Run after 20260715000013_cache_global_stats.sql.
-- The RPC should read one cached row and client roles must not read that row directly.

select
  total_sessions,
  total_events,
  total_packs,
  total_boxes,
  total_krw,
  updated_at
from public.analytics_global_stats
where singleton;

select public.get_global_stats() as rpc_result;

-- One deliberate full scan verifies that the migration preserved the previous
-- value. This is an admin-only check, not part of the public request path.
with current_stats as (
  select
    count(distinct session_id)::bigint as total_sessions,
    count(*)::bigint as total_events,
    coalesce(sum(pack_count), 0)::bigint as total_packs,
    coalesce(sum(box_count), 0)::bigint as total_boxes,
    coalesce(sum(krw), 0)::bigint as total_krw
  from public.sim_events
),
expected as (
  select
    archive.total_sessions + current_stats.total_sessions as total_sessions,
    archive.total_events + current_stats.total_events as total_events,
    archive.total_packs + current_stats.total_packs as total_packs,
    archive.total_boxes + current_stats.total_boxes as total_boxes,
    archive.total_krw + current_stats.total_krw as total_krw
  from public.analytics_sim_archive as archive
  cross join current_stats
  where archive.singleton
)
select
  cached.total_sessions = expected.total_sessions
    and cached.total_events = expected.total_events
    and cached.total_packs = expected.total_packs
    and cached.total_boxes = expected.total_boxes
    and cached.total_krw = expected.total_krw as totals_match,
  to_jsonb(cached) - 'updated_at' - 'singleton' as cached_totals,
  to_jsonb(expected) as expected_totals
from public.analytics_global_stats as cached
cross join expected
where cached.singleton;

explain (analyze, buffers)
select public.get_global_stats();

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
  has_table_privilege('anon', c.oid, 'update') as anon_can_update,
  has_table_privilege('authenticated', c.oid, 'update') as authenticated_can_update
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'analytics_global_stats';

select
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  pg_get_functiondef(p.oid) like '%analytics_global_stats%' as reads_cached_stats
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_global_stats';

select
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'sim_events'
  and trigger_name = 'capture_sim_daily_analytics';