-- Run after 20260813000016_archive_daily_luck_top10.sql.
-- This checks structure and permissions without exposing user ids or results.

select
  to_regclass('public.daily_luck_runs') as daily_luck_table,
  to_regclass('public.daily_luck_leaderboard_days') as leaderboard_days_table,
  to_regclass('public.daily_luck_leaderboard_entries') as leaderboard_entries_table,
  to_regprocedure('public.get_daily_luck_snapshot(date,uuid)') as snapshot_rpc,
  to_regprocedure('public.get_daily_luck_archive_snapshot(date,uuid)') as archive_snapshot_rpc,
  to_regprocedure('public.archive_daily_luck_day(date)') as archive_rpc,
  to_regprocedure('public.prune_daily_luck_runs()') as retention_trigger_function;

select
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
  has_table_privilege('anon', c.oid, 'insert') as anon_can_insert,
  has_table_privilege('authenticated', c.oid, 'insert') as authenticated_can_insert
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'daily_luck_runs',
    'daily_luck_leaderboard_days',
    'daily_luck_leaderboard_entries'
  )
order by c.relname;

select
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'archive_daily_luck_day',
    'get_daily_luck_archive_snapshot',
    'get_daily_luck_snapshot',
    'prune_daily_luck_runs'
  )
order by p.proname;

select
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'daily_luck_runs'
  and trigger_name = 'prune_daily_luck_runs_after_insert';

select
  day_kst,
  count(*) as archived_rows,
  max(cardinality(hit_card_nums)) as max_cards_per_row
from public.daily_luck_leaderboard_entries
group by day_kst
having count(*) > 10
  or max(cardinality(hit_card_nums)) > 3;
