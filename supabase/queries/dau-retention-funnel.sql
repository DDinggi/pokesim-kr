-- 적용 방법: Supabase Dashboard → SQL Editor → New query → 필요한 블록 복붙 후 Run
-- 목적: DAU/WAU/MAU, 재방문률(리텐션), 퍼널을 owner 권한으로 분석한다.
-- 식별자 정리:
--   session_id            : 하루 단위로 갱신되는 익명 ID  → DAU/일일 활성 집계용
--   metadata->>'visitor_id': 평생 유지되는 익명 ID         → 재방문/코호트 리텐션용
-- (둘 다 user_events 에 들어 있음. 직접 SELECT 는 RLS 로 막혀 owner 권한 필요.)

-- ============================================================
-- A. DAU / WAU / MAU
-- ============================================================

-- A-1) 일별 DAU (최근 30일)
select
  date_trunc('day', created_at)::date as day,
  count(distinct session_id)               as dau_sessions,
  count(distinct metadata->>'visitor_id')  as dau_visitors,
  count(*) filter (where event_name = 'page_view') as page_views
from public.user_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- A-2) 최근 7일 기준 WAU, 30일 기준 MAU, 그리고 stickiness(DAU/MAU)
with daily as (
  select
    date_trunc('day', created_at)::date as day,
    count(distinct metadata->>'visitor_id') as dau
  from public.user_events
  where created_at >= now() - interval '30 days'
  group by 1
)
select
  round(avg(dau))::int as avg_dau,
  (select count(distinct metadata->>'visitor_id')
     from public.user_events
    where created_at >= now() - interval '7 days')  as wau,
  (select count(distinct metadata->>'visitor_id')
     from public.user_events
    where created_at >= now() - interval '30 days')  as mau,
  round(
    avg(dau)::numeric
    / nullif((select count(distinct metadata->>'visitor_id')
                from public.user_events
               where created_at >= now() - interval '30 days'), 0)
  , 3) as stickiness_dau_over_mau
from daily;

-- ============================================================
-- B. 재방문률 (리텐션)
-- ============================================================

-- B-1) 단순 재방문률: 방문일이 2일 이상인 visitor 비율 (최근 30일)
with v as (
  select
    metadata->>'visitor_id' as visitor_id,
    count(distinct date_trunc('day', created_at)) as active_days
  from public.user_events
  where created_at >= now() - interval '30 days'
    and coalesce(metadata->>'visitor_id', '') <> ''
  group by 1
)
select
  count(*)                                          as total_visitors,
  count(*) filter (where active_days >= 2)          as returning_visitors,
  round(
    100.0 * count(*) filter (where active_days >= 2) / nullif(count(*), 0)
  , 1) as return_rate_pct
from v;

-- B-2) 코호트별 D1 / D7 리텐션
--   가입(최초 방문)일 기준으로 다음날(D1), 7일 뒤(D7) 다시 온 비율.
with first_seen as (
  select
    visitor_id,
    (timezone('Asia/Seoul', first_seen))::date as cohort_day
  from public.analytics_visitors
),
activity as (
  select
    visitor_id,
    day_kst as active_day
  from public.analytics_user_daily_activity
)
select
  f.cohort_day,
  count(distinct f.visitor_id) as cohort_size,
  count(distinct a1.visitor_id) as d1_returned,
  round(100.0 * count(distinct a1.visitor_id) / nullif(count(distinct f.visitor_id), 0), 1) as d1_pct,
  count(distinct a7.visitor_id) as d7_returned,
  round(100.0 * count(distinct a7.visitor_id) / nullif(count(distinct f.visitor_id), 0), 1) as d7_pct
from first_seen f
left join activity a1
  on a1.visitor_id = f.visitor_id and a1.active_day = f.cohort_day + 1
left join activity a7
  on a7.visitor_id = f.visitor_id and a7.active_day = f.cohort_day + 7
where f.cohort_day >= (now() - interval '30 days')::date
group by f.cohort_day
order by f.cohort_day desc;

-- B-3) 신규 vs 재방문 (일별)
--   그날 처음 본 visitor = 신규, 이전에 본 적 있으면 재방문.
with first_seen as (
  select
    visitor_id,
    (timezone('Asia/Seoul', first_seen))::date as first_day
  from public.analytics_visitors
),
daily as (
  select
    visitor_id,
    day_kst as day
  from public.analytics_user_daily_activity
)
select
  d.day,
  count(*)                                              as total,
  count(*) filter (where d.day = f.first_day)           as new_visitors,
  count(*) filter (where d.day > f.first_day)           as returning_visitors,
  round(100.0 * count(*) filter (where d.day > f.first_day) / nullif(count(*), 0), 1) as returning_pct
from daily d
join first_seen f using (visitor_id)
where d.day >= (now() - interval '30 days')::date
group by d.day
order by d.day desc;

-- ============================================================
-- C. 퍼널
-- ============================================================

-- C-1) 일별 퍼널 (세션 기준 단계별 도달 수)
select
  date_trunc('day', created_at)::date as day,
  count(distinct session_id) filter (where event_name = 'page_view')       as s1_visit,
  count(distinct session_id) filter (where event_name = 'select_mode')     as s2_mode,
  count(distinct session_id) filter (where event_name = 'select_set')      as s3_set,
  count(distinct session_id) filter (where event_name = 'open_again')      as s4_open_again,
  count(distinct session_id) filter (where event_name = 'open_card_modal') as s5_card_detail
from public.user_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- C-2) 전체 기간 퍼널 + 단계별 전환율(직전 단계 대비)
with funnel as (
  select
    count(distinct session_id) filter (where event_name = 'page_view')   as s1_visit,
    count(distinct session_id) filter (where event_name = 'select_mode') as s2_mode,
    count(distinct session_id) filter (where event_name = 'select_set')  as s3_set,
    count(distinct session_id) filter (where event_name = 'open_again')  as s4_open_again
  from public.user_events
  where created_at >= now() - interval '30 days'
)
select * from (
  values
    ('1. 방문(page_view)',      (select s1_visit      from funnel)),
    ('2. 모드 선택',            (select s2_mode       from funnel)),
    ('3. 세트 선택',            (select s3_set        from funnel)),
    ('4. 다시 뽑기(open_again)', (select s4_open_again from funnel))
) as t(step, sessions);

-- C-3) "내 운 확인" 진입 퍼널 (page_view → open_luck → view_luck)
select
  date_trunc('day', created_at)::date as day,
  count(distinct session_id) filter (where event_name = 'page_view') as visit,
  count(distinct session_id) filter (where event_name = 'open_luck') as open_luck,
  count(distinct session_id) filter (where event_name = 'view_luck') as view_luck,
  round(
    100.0 * count(distinct session_id) filter (where event_name = 'open_luck')
    / nullif(count(distinct session_id) filter (where event_name = 'page_view'), 0)
  , 1) as luck_entry_pct
from public.user_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;
