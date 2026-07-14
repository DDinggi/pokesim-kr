-- archive_analytics_events 첫 실행이 성공한 뒤 진행한다.
-- VACUUM FULL은 테이블을 잠그므로 트래픽이 적을 때 각 문장을 하나씩 선택해 실행한다.

vacuum (full, analyze) public.sim_events;

vacuum (full, analyze) public.user_events;

select
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size;
