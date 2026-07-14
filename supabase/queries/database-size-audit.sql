-- Supabase SQL Editor에서 섹션별로 실행한다.
-- 조회 전용 진단 쿼리이며 데이터는 변경하지 않는다.

-- 1) 현재 데이터베이스 전체 크기
select
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size;

-- 2) 테이블/인덱스별 점유 공간
select
  schemaname,
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as table_size,
  pg_size_pretty(pg_indexes_size(relid)) as index_size,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 30;

-- 3) 큰 인덱스 확인
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan
from pg_stat_user_indexes
order by pg_relation_size(indexrelid) desc
limit 30;

-- 4) 이벤트 테이블의 기간과 대략적인 증가량
select
  'sim_events' as table_name,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at,
  count(*) as rows
from public.sim_events
union all
select
  'user_events',
  min(created_at),
  max(created_at),
  count(*)
from public.user_events;

-- 5) 월별 이벤트 행 수
select
  'sim_events' as table_name,
  date_trunc('month', created_at) as month,
  count(*) as rows
from public.sim_events
group by 2
union all
select
  'user_events',
  date_trunc('month', created_at),
  count(*)
from public.user_events
group by 2
order by month desc, table_name;

-- 6) 보존 정책 적용 후 누적 집계와 현재 원본 범위
select
  'sim_archive' as source,
  total_events as rows,
  last_archived_at
from public.analytics_sim_archive
union all
select
  'user_archive',
  total_events,
  last_archived_at
from public.analytics_user_archive;

select
  'sim_events' as table_name,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at,
  count(*) as retained_rows
from public.sim_events
union all
select
  'user_events',
  min(created_at),
  max(created_at),
  count(*)
from public.user_events;
