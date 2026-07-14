-- Run after 20260715000012_allow_authenticated_analytics_inserts.sql.
-- This checks privileges and policies without reading analytics rows.

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('user_events', 'sim_events')
order by tablename, policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'insert') as anon_can_insert,
  has_table_privilege('authenticated', c.oid, 'insert') as authenticated_can_insert,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
  has_table_privilege('anon', c.oid, 'update') as anon_can_update,
  has_table_privilege('authenticated', c.oid, 'update') as authenticated_can_update,
  has_table_privilege('anon', c.oid, 'delete') as anon_can_delete,
  has_table_privilege('authenticated', c.oid, 'delete') as authenticated_can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_events', 'sim_events')
order by c.relname;
select
  source.table_name,
  source.sequence_name,
  case
    when source.sequence_name is null then null
    else has_sequence_privilege('anon', source.sequence_name, 'usage')
  end as anon_can_use_sequence,
  case
    when source.sequence_name is null then null
    else has_sequence_privilege('authenticated', source.sequence_name, 'usage')
  end as authenticated_can_use_sequence
from (
  values
    ('user_events', pg_get_serial_sequence('public.user_events', 'id')),
    ('sim_events', pg_get_serial_sequence('public.sim_events', 'id'))
) as source(table_name, sequence_name)
order by source.table_name;
