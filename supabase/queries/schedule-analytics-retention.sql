-- 먼저 Dashboard -> Integrations -> Cron에서 pg_cron을 활성화한다.
-- 매일 03:20 KST(전날 18:20 UTC)에 보존 기간을 넘긴 원본 이벤트를 집계 후 정리한다.

-- Apply 20260712000009_preserve_daily_analytics.sql before scheduling this job.
-- Re-running this file replaces the existing schedule instead of duplicating it.
select cron.unschedule(jobid)
from cron.job
where jobname = 'pokesim-analytics-retention';

select cron.schedule(
  'pokesim-analytics-retention',
  '20 18 * * *',
  $$select public.archive_analytics_events(14, 30)$$
);

select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'pokesim-analytics-retention';
