-- Run after 20260712000009_preserve_daily_analytics.sql.
-- The date range should remain available even after raw events expire.

select
  min(day_kst) as first_activity_day,
  max(day_kst) as last_activity_day,
  count(*) as visitor_days,
  count(distinct visitor_id) as unique_visitors
from public.analytics_user_daily_activity;

select
  day_kst,
  count(*) as visitor_dau
from public.analytics_user_daily_activity
group by day_kst
order by day_kst desc
limit 30;

select
  d.day_kst,
  count(s.session_id) as sim_sessions,
  d.total_events,
  d.total_boxes,
  d.total_packs,
  d.total_krw
from public.analytics_sim_daily d
left join public.analytics_sim_daily_sessions s using (day_kst)
group by
  d.day_kst,
  d.total_events,
  d.total_boxes,
  d.total_packs,
  d.total_krw
order by d.day_kst desc
limit 30;
