-- Supabase SQL Editor에서 전체 실행한다.
-- 데이터 행은 삭제하지 않고, 원본 이벤트 조회에 불필요한 대형 인덱스만 제거한다.
-- 실행 전 측정값: user_events 543 MB, sim_events 399 MB, 전체 약 952 MB.

set session characteristics as transaction read write;

begin;

drop index if exists public.idx_user_events_session_created;
drop index if exists public.idx_user_events_set_created;
drop index if exists public.idx_user_events_event_created;
drop index if exists public.idx_user_events_created_at;

drop index if exists public.idx_sim_events_session_luck;
drop index if exists public.sim_events_created_idx;
drop index if exists public.idx_sim_events_luck_created;

create index if not exists idx_user_events_created_at_brin
  on public.user_events using brin (created_at);

commit;

select
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size;

select
  tablename as table_name,
  indexname as remaining_index
from pg_indexes
where schemaname = 'public'
  and tablename in ('user_events', 'sim_events')
order by tablename, indexname;
