-- Google record backup rollout health check.
-- This intentionally avoids selecting email, name, raw payload, or card-level data.

-- 1) Auth users and record backup coverage.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.user_record_backups) as backup_rows,
  (select count(*) from auth.users u left join public.user_record_backups b on b.user_id = u.id where b.user_id is null) as users_without_backup,
  (select count(*) from public.user_record_backups b left join auth.users u on u.id = b.user_id where u.id is null) as orphan_backup_rows;

-- 2) Recent signups and backup writes by hour.
with hours as (
  select generate_series(
    date_trunc('hour', now() - interval '24 hours'),
    date_trunc('hour', now()),
    interval '1 hour'
  ) as hour
)
select
  hours.hour,
  coalesce(signups.users, 0) as new_users,
  coalesce(backups.rows_written, 0) as backup_writes
from hours
left join (
  select date_trunc('hour', created_at) as hour, count(*) as users
  from auth.users
  where created_at >= now() - interval '24 hours'
  group by 1
) as signups using (hour)
left join (
  select date_trunc('hour', updated_at) as hour, count(*) as rows_written
  from public.user_record_backups
  where updated_at >= now() - interval '24 hours'
  group by 1
) as backups using (hour)
order by hours.hour desc;

-- 3) Payload size guardrail.
select
  count(*) as backup_rows,
  pg_size_pretty(avg(octet_length(payload::text))::bigint) as avg_payload_size,
  pg_size_pretty(percentile_disc(0.95) within group (order by octet_length(payload::text))::bigint) as p95_payload_size,
  pg_size_pretty(max(octet_length(payload::text))::bigint) as max_payload_size,
  count(*) filter (where octet_length(payload::text) > 49152) as rows_over_48kb,
  count(*) filter (where octet_length(payload::text) > 61440) as rows_over_60kb
from public.user_record_backups;

-- 4) Backup freshness.
select
  count(*) filter (where updated_at >= now() - interval '10 minutes') as updated_10m,
  count(*) filter (where updated_at >= now() - interval '1 hour') as updated_1h,
  count(*) filter (where updated_at >= now() - interval '24 hours') as updated_24h,
  max(updated_at) as latest_backup_at
from public.user_record_backups;

-- 5) Source count distribution. Source ids are browser-local random ids, not user identifiers.
select
  source_count,
  count(*) as backup_rows
from (
  select count(source.source_id) as source_count
  from public.user_record_backups b
  left join lateral jsonb_object_keys(b.payload->'s') as source(source_id) on true
  group by b.user_id
) as counted
group by source_count
order by source_count;

-- 6) Table and index footprint.
select
  schemaname,
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as table_size,
  pg_size_pretty(pg_indexes_size(relid)) as index_size,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows
from pg_stat_user_tables
where schemaname = 'public'
  and relname = 'user_record_backups';
