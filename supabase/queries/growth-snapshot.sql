-- 적용 방법: Supabase Dashboard -> SQL Editor -> New query -> 필요한 블록 복붙 후 Run
-- 목적: 면접/포트폴리오용 핵심 성장 지표 스냅샷을 같은 기준으로 뽑는다.
--
-- 기준:
--   - 날짜는 KST 기준 complete day(오늘 제외)로 집계한다.
--   - DAU/리텐션은 user_events.metadata->>'visitor_id' 기준이다.
--   - session_id는 하루 단위 익명 세션이라 누적 세션/시뮬 집계에 쓴다.
--   - 운영비는 Supabase 이벤트 DB만으로는 실제 청구액을 알 수 없어 수동 입력 CTE를 쓴다.

-- ============================================================
-- 0) 데이터 수집 상태 점검
-- ============================================================
select
  min(created_at) as first_event_at,
  max(created_at) as last_event_at,
  count(*) as user_events,
  count(*) filter (
    where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  ) as events_with_visitor_id,
  round(
    100.0 * count(*) filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) / nullif(count(*), 0),
    1
  ) as visitor_id_coverage_pct
from public.user_events;

-- ============================================================
-- 1-A) 현재 DAU(최근 7일 평균) + 추세
--   - baseline_dau는 이전에 말한 308로 둔다. 필요하면 수정.
--   - trend_vs_prev_7d: 직전 7일 대비 증가/감소/유지.
--   - trend_vs_308: 308 대비 증가/감소/유지.
-- ============================================================
with params as (
  select
    (timezone('Asia/Seoul', now()))::date as today_kst,
    308::numeric as baseline_dau,
    0.05::numeric as neutral_threshold -- +-5% 이내는 유지
),
daily as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as dau,
    count(distinct session_id) as daily_sessions,
    count(*) filter (where event_name = 'page_view') as page_views
  from public.user_events
  where created_at >= now() - interval '21 days'
  group by 1
),
periods as (
  select
    avg(dau) filter (
      where day_kst >= (select today_kst - 7 from params)
        and day_kst <  (select today_kst from params)
    ) as dau_7d_avg,
    avg(dau) filter (
      where day_kst >= (select today_kst - 14 from params)
        and day_kst <  (select today_kst - 7 from params)
    ) as prev_7d_avg,
    sum(page_views) filter (
      where day_kst >= (select today_kst - 7 from params)
        and day_kst <  (select today_kst from params)
    ) as page_views_7d,
    sum(daily_sessions) filter (
      where day_kst >= (select today_kst - 7 from params)
        and day_kst <  (select today_kst from params)
    ) as sessions_7d
  from daily
)
select
  round(dau_7d_avg, 1) as dau_7d_avg,
  round(prev_7d_avg, 1) as prev_7d_avg,
  round(100.0 * (dau_7d_avg - prev_7d_avg) / nullif(prev_7d_avg, 0), 1) as delta_vs_prev_7d_pct,
  case
    when abs((dau_7d_avg - prev_7d_avg) / nullif(prev_7d_avg, 0)) <= (select neutral_threshold from params) then '유지'
    when dau_7d_avg > prev_7d_avg then '증가'
    else '감소'
  end as trend_vs_prev_7d,
  308 as old_reference_dau,
  round(100.0 * (dau_7d_avg - (select baseline_dau from params)) / nullif((select baseline_dau from params), 0), 1) as delta_vs_308_pct,
  case
    when abs((dau_7d_avg - (select baseline_dau from params)) / nullif((select baseline_dau from params), 0)) <= (select neutral_threshold from params) then '유지'
    when dau_7d_avg > (select baseline_dau from params) then '증가'
    else '감소'
  end as trend_vs_308,
  page_views_7d,
  sessions_7d
from periods;

-- ============================================================
-- 1-A-2) 한달 평균 DAU / 누적 DAU 검증용
--   - dau_30d_avg: 최근 30개 complete day 평균 DAU.
--   - dau_30d_sum: 30일 일별 DAU의 합. 같은 사람이 여러 날 오면 여러 번 카운트된다.
--   - mau_30d_unique_visitors: 최근 30일 순방문자. 보통 "MAU"로 말할 값.
--   - cumulative_unique_visitors: 서비스 시작 이후 누적 순방문자.
-- ============================================================
with params as (
  select
    (timezone('Asia/Seoul', now()))::date as today_kst,
    ((timezone('Asia/Seoul', now()))::date - 30) as start_day,
    ((timezone('Asia/Seoul', now()))::date - 1) as end_day
),
days as (
  select generate_series(
    (select start_day from params),
    (select end_day from params),
    interval '1 day'
  )::date as day_kst
),
daily as (
  select
    d.day_kst,
    count(distinct ue.metadata->>'visitor_id') filter (
      where coalesce(ue.metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as dau_visitors,
    count(distinct ue.session_id) as dau_sessions,
    count(*) filter (where ue.event_name = 'page_view') as page_views
  from days d
  left join public.user_events ue
    on (timezone('Asia/Seoul', ue.created_at))::date = d.day_kst
  group by 1
),
month_unique as (
  select
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as mau_30d_unique_visitors,
    count(distinct session_id) as active_sessions_30d
  from public.user_events
  where (timezone('Asia/Seoul', created_at))::date between
    (select start_day from params) and (select end_day from params)
),
all_time_unique as (
  select
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as cumulative_unique_visitors,
    count(distinct session_id) as cumulative_sessions
  from public.user_events
)
select
  (select start_day from params) as start_day_kst,
  (select end_day from params) as end_day_kst,
  round(avg(daily.dau_visitors), 1) as dau_30d_avg,
  percentile_cont(0.5) within group (order by daily.dau_visitors) as dau_30d_median,
  min(daily.dau_visitors) as dau_30d_min,
  max(daily.dau_visitors) as dau_30d_max,
  sum(daily.dau_visitors) as dau_30d_sum,
  month_unique.mau_30d_unique_visitors,
  round(sum(daily.dau_visitors)::numeric / nullif(month_unique.mau_30d_unique_visitors, 0), 2) as avg_active_days_per_mau,
  month_unique.active_sessions_30d,
  all_time_unique.cumulative_unique_visitors,
  all_time_unique.cumulative_sessions
from daily
cross join month_unique
cross join all_time_unique
group by
  month_unique.mau_30d_unique_visitors,
  month_unique.active_sessions_30d,
  all_time_unique.cumulative_unique_visitors,
  all_time_unique.cumulative_sessions;

-- 1-A-2b) DAU/MAU sanity check: 1100 vs 6000처럼 숫자가 안 맞을 때 먼저 볼 것
--   - visitor_id_unique는 "사람/브라우저"에 가까운 순방문자다. 리텐션용으로 제일 엄격하다.
--   - session_id는 하루마다 새로 발급되므로 30일 distinct session_id는 "방문자 수"가 아니라 "방문 session-days"다.
--   - sim_events는 시뮬을 실제로 돌린 사용자만 남는다. user_events 수집 전/누락 구간 보정용으로 같이 본다.
with params as (
  select
    ((timezone('Asia/Seoul', now()))::date - 30) as start_day,
    ((timezone('Asia/Seoul', now()))::date - 1) as end_day
),
user_scope as (
  select *
  from public.user_events
  where (timezone('Asia/Seoul', created_at))::date between
    (select start_day from params) and (select end_day from params)
),
sim_scope as (
  select *
  from public.sim_events
  where (timezone('Asia/Seoul', created_at))::date between
    (select start_day from params) and (select end_day from params)
),
combined_sessions as (
  select (timezone('Asia/Seoul', created_at))::date as day_kst, session_id
  from user_scope
  union
  select (timezone('Asia/Seoul', created_at))::date as day_kst, session_id
  from sim_scope
),
daily_user as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as visitor_dau,
    count(distinct session_id) as user_event_sessions,
    count(distinct session_id) filter (where event_name = 'page_view') as page_view_sessions
  from user_scope
  group by 1
),
daily_sim as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct session_id) as sim_sessions,
    coalesce(sum(pack_count), 0) as packs
  from sim_scope
  group by 1
),
daily_combined as (
  select
    day_kst,
    count(distinct session_id) as combined_active_sessions
  from combined_sessions
  group by 1
),
daily as (
  select
    coalesce(u.day_kst, s.day_kst, c.day_kst) as day_kst,
    coalesce(u.visitor_dau, 0) as visitor_dau,
    coalesce(u.user_event_sessions, 0) as user_event_sessions,
    coalesce(u.page_view_sessions, 0) as page_view_sessions,
    coalesce(s.sim_sessions, 0) as sim_sessions,
    coalesce(c.combined_active_sessions, 0) as combined_active_sessions,
    coalesce(s.packs, 0) as packs
  from daily_user u
  full join daily_sim s using (day_kst)
  full join daily_combined c using (day_kst)
)
select *
from (
  select
    'A. visitor_id 기준 30일 순방문자(MAU)' as metric,
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    )::numeric as value,
    '리텐션/MAU에 쓸 엄격한 값. visitor_id 도입 전/누락 이벤트는 빠진다.' as meaning
  from user_scope

  union all

  select
    'B. visitor_id 기준 30일 DAU 합계',
    sum(visitor_dau)::numeric,
    '일별 DAU를 더한 값. 같은 유저가 여러 날 오면 여러 번 카운트된다.'
  from daily

  union all

  select
    'C. user_events 기준 30일 session-days',
    count(distinct session_id)::numeric,
    'session_id는 하루마다 새로 발급된다. 6000에 가까운 값이 보통 여기서 나온다.'
  from user_scope

  union all

  select
    'D. page_view 기준 30일 session-days',
    count(distinct session_id) filter (where event_name = 'page_view')::numeric,
    '방문(page_view)이 찍힌 일일 세션 수.'
  from user_scope

  union all

  select
    'E. sim_events 기준 30일 session-days',
    count(distinct session_id)::numeric,
    '시뮬을 실제로 한 일일 세션 수. user_events보다 예전부터 안정적으로 쌓였을 수 있다.'
  from sim_scope

  union all

  select
    'F. user_events + sim_events 합산 30일 active session-days',
    count(distinct day_kst::text || ':' || session_id)::numeric,
    '방문/시뮬 양쪽을 합친 활동 세션일. 단, 사람 수가 아니라 세션일이다.'
  from combined_sessions

  union all

  select
    'G. 최근 30일 평균 DAU(visitor_id)',
    round(avg(visitor_dau), 1),
    '면접에서 DAU라고 말하기 가장 안전한 값. visitor_id 커버리지 확인 필요.'
  from daily

  union all

  select
    'H. 최근 30일 평균 active sessions(합산)',
    round(avg(combined_active_sessions), 1),
    '방문 규모/트래픽 설명용. DAU보다 크게 나오는 게 정상이다.'
  from daily
) metrics
order by metric;

-- 1-A-2c) visitor_id 수집 커버리지 일별 점검
--   - visitor_id_coverage_pct가 낮은 날짜는 MAU/DAU(visitor_id)가 과소집계된다.
select
  (timezone('Asia/Seoul', created_at))::date as day_kst,
  count(*) as user_events,
  count(*) filter (where event_name = 'page_view') as page_views,
  count(distinct session_id) as sessions,
  count(distinct metadata->>'visitor_id') filter (
    where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  ) as visitors,
  round(
    100.0 * count(*) filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) / nullif(count(*), 0),
    1
  ) as visitor_id_coverage_pct,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at
from public.user_events
where created_at >= now() - interval '45 days'
group by 1
order by 1 desc;

-- 1-A-2d) 일별 visitor DAU vs session DAU vs sim sessions
--   - 6000이 어느 열에서 나오는지 이 표로 역추적한다.
with days as (
  select generate_series(
    (timezone('Asia/Seoul', now()))::date - 30,
    (timezone('Asia/Seoul', now()))::date - 1,
    interval '1 day'
  )::date as day_kst
),
u as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as visitor_dau,
    count(distinct session_id) as user_event_sessions,
    count(distinct session_id) filter (where event_name = 'page_view') as page_view_sessions
  from public.user_events
  where created_at >= now() - interval '31 days'
  group by 1
),
s as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct session_id) as sim_sessions,
    coalesce(sum(pack_count), 0) as packs
  from public.sim_events
  where created_at >= now() - interval '31 days'
  group by 1
),
c as (
  select
    day_kst,
    count(distinct session_id) as combined_active_sessions
  from (
    select (timezone('Asia/Seoul', created_at))::date as day_kst, session_id
    from public.user_events
    where created_at >= now() - interval '31 days'
    union
    select (timezone('Asia/Seoul', created_at))::date as day_kst, session_id
    from public.sim_events
    where created_at >= now() - interval '31 days'
  ) x
  group by 1
)
select
  d.day_kst,
  coalesce(u.visitor_dau, 0) as visitor_dau,
  coalesce(u.user_event_sessions, 0) as user_event_sessions,
  coalesce(u.page_view_sessions, 0) as page_view_sessions,
  coalesce(s.sim_sessions, 0) as sim_sessions,
  coalesce(c.combined_active_sessions, 0) as combined_active_sessions,
  coalesce(s.packs, 0) as packs
from days d
left join u using (day_kst)
left join s using (day_kst)
left join c using (day_kst)
order by d.day_kst desc;

-- 1-A-3) 일별 DAU + 누적 순방문자 검증표
--   - cumulative_unique_visitors_to_day는 그 날짜까지 한 번이라도 온 순방문자 누적.
--   - rolling_30d_avg_dau는 각 날짜 기준 최근 30일 평균 DAU.
with daily as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct metadata->>'visitor_id') filter (
      where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    ) as dau_visitors,
    count(distinct session_id) as dau_sessions,
    count(*) filter (where event_name = 'page_view') as page_views
  from public.user_events
  group by 1
),
first_seen as (
  select
    metadata->>'visitor_id' as visitor_id,
    min((timezone('Asia/Seoul', created_at))::date) as first_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by 1
),
daily_with_cumulative as (
  select
    d.day_kst,
    d.dau_visitors,
    d.dau_sessions,
    d.page_views,
    (
      select count(*)
      from first_seen f
      where f.first_day <= d.day_kst
    ) as cumulative_unique_visitors_to_day
  from daily d
)
select
  day_kst,
  dau_visitors,
  dau_sessions,
  page_views,
  cumulative_unique_visitors_to_day,
  round(
    avg(dau_visitors) over (
      order by day_kst
      rows between 29 preceding and current row
    ),
    1
  ) as rolling_30d_avg_dau
from daily_with_cumulative
where day_kst >= (timezone('Asia/Seoul', now()))::date - 45
  and day_kst <  (timezone('Asia/Seoul', now()))::date
order by day_kst desc;

-- ============================================================
-- 1-B) 왜 늘었나/줄었나: 유입 채널별 7일 증감 기여
--   - sessions_delta가 큰 채널이 DAU 변화 원인 후보.
-- ============================================================
with params as (
  select (timezone('Asia/Seoul', now()))::date as today_kst
),
page_views as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    session_id,
    metadata->>'visitor_id' as visitor_id,
    lower(coalesce(nullif(metadata->>'utm_source', ''), '')) as utm_source,
    lower(coalesce(nullif(regexp_replace(nullif(metadata->>'referrer', ''), '^https?://([^/]+).*$', '\1'), ''), '')) as referrer_host
  from public.user_events
  where event_name = 'page_view'
    and created_at >= now() - interval '14 days'
),
bucketed as (
  select
    day_kst,
    session_id,
    visitor_id,
    case
      when utm_source <> '' then 'utm:' || utm_source
      when referrer_host = '' then '직접/북마크'
      when referrer_host like '%pokesim.kr%' then '내부/자체'
      when referrer_host like '%cafe.naver.com%' then '네이버카페'
      when referrer_host like '%naver.com%' then '네이버검색/네이버'
      when referrer_host like '%fmkorea.com%' then '펨코'
      when referrer_host like '%instagram.com%' then '인스타'
      when referrer_host in ('t.co', 'x.com', 'twitter.com') or referrer_host like '%.twitter.com' then 'X/트위터'
      when referrer_host like '%google.%' then '구글'
      else referrer_host
    end as source_bucket
  from page_views
),
agg as (
  select
    source_bucket,
    count(distinct session_id) filter (
      where day_kst >= (select today_kst - 7 from params)
        and day_kst <  (select today_kst from params)
    ) as sessions_7d,
    count(distinct session_id) filter (
      where day_kst >= (select today_kst - 14 from params)
        and day_kst <  (select today_kst - 7 from params)
    ) as prev_sessions_7d,
    count(distinct visitor_id) filter (
      where coalesce(visitor_id, '') not in ('', 'unknown')
        and day_kst >= (select today_kst - 7 from params)
        and day_kst <  (select today_kst from params)
    ) as visitors_7d
  from bucketed
  group by 1
)
select
  source_bucket,
  sessions_7d,
  prev_sessions_7d,
  sessions_7d - prev_sessions_7d as sessions_delta,
  visitors_7d,
  round(100.0 * sessions_7d / nullif(sum(sessions_7d) over (), 0), 1) as share_7d_pct
from agg
where sessions_7d > 0 or prev_sessions_7d > 0
order by abs(sessions_7d - prev_sessions_7d) desc, sessions_7d desc;

-- ============================================================
-- 1-C) 왜 늘었나/줄었나: 시뮬 깊이 변화
--   - DAU가 유지인데 packs/user가 오르면 더 깊게 쓰는 중.
--   - DAU가 늘었는데 packs/user가 내려가면 신규 유입이 얕을 수 있음.
-- ============================================================
with params as (
  select (timezone('Asia/Seoul', now()))::date as today_kst
),
daily_visitors as (
  select distinct
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    metadata->>'visitor_id' as visitor_id
  from public.user_events
  where created_at >= now() - interval '14 days'
    and coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
),
sim_daily as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct session_id) as sim_sessions,
    count(*) as sim_events,
    coalesce(sum(box_count), 0) as boxes,
    coalesce(sum(pack_count), 0) as packs
  from public.sim_events
  where created_at >= now() - interval '14 days'
  group by 1
),
joined as (
  select
    d.day_kst,
    count(distinct d.visitor_id) as dau,
    coalesce(s.sim_sessions, 0) as sim_sessions,
    coalesce(s.sim_events, 0) as sim_events,
    coalesce(s.boxes, 0) as boxes,
    coalesce(s.packs, 0) as packs
  from daily_visitors d
  left join sim_daily s using (day_kst)
  group by 1, s.sim_sessions, s.sim_events, s.boxes, s.packs
),
periods as (
  select
    case
      when day_kst >= (select today_kst - 7 from params) then 'last_7d'
      else 'prev_7d'
    end as period,
    avg(dau) as avg_dau,
    sum(sim_sessions) as sim_sessions,
    sum(sim_events) as sim_events,
    sum(boxes) as boxes,
    sum(packs) as packs
  from joined
  where day_kst >= (select today_kst - 14 from params)
    and day_kst <  (select today_kst from params)
  group by 1
)
select
  period,
  round(avg_dau, 1) as avg_dau,
  sim_sessions,
  sim_events,
  boxes,
  packs,
  round(packs::numeric / nullif(avg_dau * 7, 0), 1) as packs_per_active_visitor
from periods
order by period desc;

-- ============================================================
-- 2-A) D1 / D7 리텐션 정확 수치(전체 요약)
--   - D1: cohort_day+1에 재방문한 비율. 오늘/어제 코호트 제외.
--   - D7: cohort_day+7에 재방문한 비율. 최근 7일 미성숙 코호트 제외.
-- ============================================================
with params as (
  select (timezone('Asia/Seoul', now()))::date as today_kst
),
first_seen as (
  select
    metadata->>'visitor_id' as visitor_id,
    min((timezone('Asia/Seoul', created_at))::date) as cohort_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by 1
),
activity as (
  select distinct
    metadata->>'visitor_id' as visitor_id,
    (timezone('Asia/Seoul', created_at))::date as active_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
),
d1 as (
  select
    count(distinct f.visitor_id) as cohort_size,
    count(distinct a.visitor_id) as returned
  from first_seen f
  left join activity a
    on a.visitor_id = f.visitor_id
   and a.active_day = f.cohort_day + 1
  where f.cohort_day >= (select today_kst - 30 from params)
    and f.cohort_day <= (select today_kst - 2 from params)
),
d7 as (
  select
    count(distinct f.visitor_id) as cohort_size,
    count(distinct a.visitor_id) as returned
  from first_seen f
  left join activity a
    on a.visitor_id = f.visitor_id
   and a.active_day = f.cohort_day + 7
  where f.cohort_day >= (select today_kst - 30 from params)
    and f.cohort_day <= (select today_kst - 8 from params)
)
select
  d1.cohort_size as d1_matured_cohort,
  d1.returned as d1_returned,
  round(100.0 * d1.returned / nullif(d1.cohort_size, 0), 2) as d1_retention_pct,
  d7.cohort_size as d7_matured_cohort,
  d7.returned as d7_returned,
  round(100.0 * d7.returned / nullif(d7.cohort_size, 0), 2) as d7_retention_pct
from d1 cross join d7;

-- 2-B) D1 / D7 리텐션 코호트별 상세
with first_seen as (
  select
    metadata->>'visitor_id' as visitor_id,
    min((timezone('Asia/Seoul', created_at))::date) as cohort_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by 1
),
activity as (
  select distinct
    metadata->>'visitor_id' as visitor_id,
    (timezone('Asia/Seoul', created_at))::date as active_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
)
select
  f.cohort_day,
  count(distinct f.visitor_id) as cohort_size,
  count(distinct a1.visitor_id) as d1_returned,
  round(100.0 * count(distinct a1.visitor_id) / nullif(count(distinct f.visitor_id), 0), 2) as d1_pct,
  count(distinct a7.visitor_id) as d7_returned,
  round(100.0 * count(distinct a7.visitor_id) / nullif(count(distinct f.visitor_id), 0), 2) as d7_pct
from first_seen f
left join activity a1
  on a1.visitor_id = f.visitor_id
 and a1.active_day = f.cohort_day + 1
left join activity a7
  on a7.visitor_id = f.visitor_id
 and a7.active_day = f.cohort_day + 7
where f.cohort_day >= ((timezone('Asia/Seoul', now()))::date - 30)
  and f.cohort_day <  (timezone('Asia/Seoul', now()))::date
group by 1
order by 1 desc;

-- ============================================================
-- 3) 유입 출처 분포(referrer + UTM)
-- ============================================================
with page_views as (
  select
    session_id,
    metadata->>'visitor_id' as visitor_id,
    lower(coalesce(nullif(metadata->>'utm_source', ''), '')) as utm_source,
    lower(coalesce(nullif(metadata->>'utm_medium', ''), '')) as utm_medium,
    lower(coalesce(nullif(metadata->>'utm_campaign', ''), '')) as utm_campaign,
    lower(coalesce(nullif(regexp_replace(nullif(metadata->>'referrer', ''), '^https?://([^/]+).*$', '\1'), ''), '')) as referrer_host
  from public.user_events
  where event_name = 'page_view'
    and created_at >= now() - interval '30 days'
),
bucketed as (
  select
    *,
    case
      when utm_source <> '' then 'utm:' || utm_source
      when referrer_host = '' then '직접/북마크'
      when referrer_host like '%pokesim.kr%' then '내부/자체'
      when referrer_host like '%cafe.naver.com%' then '네이버카페'
      when referrer_host like '%naver.com%' then '네이버검색/네이버'
      when referrer_host like '%fmkorea.com%' then '펨코'
      when referrer_host like '%instagram.com%' then '인스타'
      when referrer_host in ('t.co', 'x.com', 'twitter.com') or referrer_host like '%.twitter.com' then 'X/트위터'
      when referrer_host like '%google.%' then '구글'
      else referrer_host
    end as source_bucket
  from page_views
)
select
  source_bucket,
  count(*) as page_views,
  count(distinct session_id) as sessions,
  count(distinct visitor_id) filter (where coalesce(visitor_id, '') not in ('', 'unknown')) as visitors,
  round(100.0 * count(distinct session_id) / nullif(sum(count(distinct session_id)) over (), 0), 1) as sessions_share_pct,
  string_agg(distinct nullif(referrer_host, ''), ', ' order by nullif(referrer_host, '')) as raw_hosts,
  string_agg(distinct nullif(utm_campaign, ''), ', ' order by nullif(utm_campaign, '')) as utm_campaigns
from bucketed
group by 1
order by sessions desc, page_views desc;

-- ============================================================
-- 4) 현재 월 운영비
--   - Supabase 이벤트 DB로는 실제 청구액을 자동 조회할 수 없다.
--   - Billing dashboard 값을 아래 values에 업데이트해서 한 줄 표로 보관한다.
-- ============================================================
with cost_items(provider, item, usd_monthly, note) as (
  values
    ('Cloudflare', 'Workers / Static Assets', 0.00::numeric, '무료 티어면 0으로 유지'),
    ('Cloudflare', 'R2 storage / operations', 0.00::numeric, 'R2 청구액 입력'),
    ('Supabase', 'DB / API', 0.00::numeric, '무료 티어면 0, Pro면 25 등으로 수정'),
    ('Domain', 'domain amortized monthly', 6.00::numeric, '현재 보고값이 $6이면 여기에 유지'),
    ('Other', 'misc', 0.00::numeric, '필요 시 수정')
)
select
  provider,
  item,
  usd_monthly,
  note
from cost_items
union all
select
  'TOTAL',
  'monthly operating cost',
  sum(usd_monthly),
  '이 합계를 현재 월 운영비로 보고'
from cost_items
order by provider, item;

-- ============================================================
-- 5) 누적 세션 + 시뮬레이션 총량
--   - 기존 "2,154 세션 / 146만 팩" 업데이트용.
-- ============================================================
select
  count(distinct session_id) as total_sim_sessions,
  count(*) as total_sim_events,
  coalesce(sum(box_count), 0) as total_boxes,
  coalesce(sum(pack_count), 0) as total_packs,
  coalesce(sum(krw), 0) as total_krw,
  min(created_at) as first_sim_at,
  max(created_at) as last_sim_at
from public.sim_events;

select
  count(distinct session_id) as total_user_sessions,
  count(distinct metadata->>'visitor_id') filter (
    where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  ) as total_visitors,
  count(*) filter (where event_name = 'page_view') as total_page_views,
  count(*) as total_user_events
from public.user_events;

-- ============================================================
-- 6-A) 3일 주기 효과: cycle day별 평균 DAU/재방문/시뮬
--   - first_update_day를 실제 사이클 시작일로 수정.
--   - 현재 공지가 4일 주기라면 cycle_days를 4로 바꾸면 된다.
--   - day_in_cycle=0이 업데이트/사이클 당일.
-- ============================================================
with params as (
  select
    date '2026-05-20' as first_update_day, -- TODO: 실제 첫 업데이트/공지일로 수정
    3::int as cycle_days,
    (timezone('Asia/Seoul', now()))::date as today_kst
),
first_seen as (
  select
    metadata->>'visitor_id' as visitor_id,
    min((timezone('Asia/Seoul', created_at))::date) as first_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by 1
),
daily_activity as (
  select distinct
    metadata->>'visitor_id' as visitor_id,
    (timezone('Asia/Seoul', created_at))::date as day_kst
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    and created_at >= (select first_update_day from params)
),
daily_user as (
  select
    d.day_kst,
    count(distinct d.visitor_id) as dau,
    count(distinct d.visitor_id) filter (where d.day_kst > f.first_day) as returning_visitors,
    count(distinct d.visitor_id) filter (where d.day_kst = f.first_day) as new_visitors
  from daily_activity d
  join first_seen f using (visitor_id)
  group by 1
),
daily_sim as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct session_id) as sim_sessions,
    coalesce(sum(pack_count), 0) as packs,
    coalesce(sum(box_count), 0) as boxes
  from public.sim_events
  where created_at >= (select first_update_day from params)
  group by 1
),
joined as (
  select
    u.day_kst,
    mod((u.day_kst - (select first_update_day from params))::int, (select cycle_days from params)) as day_in_cycle,
    u.dau,
    u.returning_visitors,
    u.new_visitors,
    coalesce(s.sim_sessions, 0) as sim_sessions,
    coalesce(s.packs, 0) as packs,
    coalesce(s.boxes, 0) as boxes
  from daily_user u
  left join daily_sim s using (day_kst)
  where u.day_kst >= (select first_update_day from params)
    and u.day_kst <  (select today_kst from params)
)
select
  day_in_cycle,
  case when day_in_cycle = 0 then '업데이트/사이클 당일' else '사이클 +' || day_in_cycle::text || '일' end as cycle_label,
  count(*) as days,
  round(avg(dau), 1) as avg_dau,
  round(avg(returning_visitors), 1) as avg_returning_visitors,
  round(100.0 * sum(returning_visitors) / nullif(sum(dau), 0), 1) as returning_share_pct,
  round(avg(sim_sessions), 1) as avg_sim_sessions,
  round(avg(packs), 1) as avg_packs,
  round(avg(boxes), 1) as avg_boxes
from joined
group by 1, 2
order by 1;

-- 6-B) 3일 주기 효과: 업데이트 당일 vs 그 외 요약
with params as (
  select
    date '2026-05-20' as first_update_day, -- TODO: 실제 첫 업데이트/공지일로 수정
    3::int as cycle_days,
    (timezone('Asia/Seoul', now()))::date as today_kst
),
first_seen as (
  select
    metadata->>'visitor_id' as visitor_id,
    min((timezone('Asia/Seoul', created_at))::date) as first_day
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by 1
),
daily_activity as (
  select distinct
    metadata->>'visitor_id' as visitor_id,
    (timezone('Asia/Seoul', created_at))::date as day_kst
  from public.user_events
  where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
    and created_at >= (select first_update_day from params)
),
daily_user as (
  select
    d.day_kst,
    count(distinct d.visitor_id) as dau,
    count(distinct d.visitor_id) filter (where d.day_kst > f.first_day) as returning_visitors
  from daily_activity d
  join first_seen f using (visitor_id)
  group by 1
),
daily_sim as (
  select
    (timezone('Asia/Seoul', created_at))::date as day_kst,
    count(distinct session_id) as sim_sessions,
    coalesce(sum(pack_count), 0) as packs
  from public.sim_events
  where created_at >= (select first_update_day from params)
  group by 1
),
joined as (
  select
    u.day_kst,
    (mod((u.day_kst - (select first_update_day from params))::int, (select cycle_days from params)) = 0) as is_cycle_day,
    u.dau,
    u.returning_visitors,
    coalesce(s.sim_sessions, 0) as sim_sessions,
    coalesce(s.packs, 0) as packs
  from daily_user u
  left join daily_sim s using (day_kst)
  where u.day_kst >= (select first_update_day from params)
    and u.day_kst <  (select today_kst from params)
)
select
  case when is_cycle_day then 'cycle_day' else 'non_cycle_day' end as period_type,
  count(*) as days,
  round(avg(dau), 1) as avg_dau,
  round(avg(returning_visitors), 1) as avg_returning_visitors,
  round(100.0 * sum(returning_visitors) / nullif(sum(dau), 0), 1) as returning_share_pct,
  round(avg(sim_sessions), 1) as avg_sim_sessions,
  round(avg(packs), 1) as avg_packs
from joined
group by 1
order by period_type;
