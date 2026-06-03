-- 적용 방법: Supabase Dashboard → SQL Editor → New query → 필요한 블록 복붙 후 Run
-- 목적: page_view 이벤트의 metadata.referrer / utm_* 를 owner 권한으로 분석한다.
-- 참고: referrer 는 별도 컬럼이 아니라 user_events.metadata->>'referrer' 에 저장됨.
--       값이 ''(직접 유입/북마크)인 경우가 많으니 NULLIF 로 정리해서 본다.

-- ============================================================
-- 1) referrer 도메인별 유입 (최근 30일)
-- ============================================================
select
  coalesce(
    nullif(
      regexp_replace(
        nullif(metadata->>'referrer', ''),
        '^https?://([^/]+).*$', '\1'
      ),
      ''
    ),
    '(direct / none)'
  ) as referrer_host,
  count(*)                       as page_views,
  count(distinct session_id)     as sessions
from public.user_events
where event_name = 'page_view'
  and created_at >= now() - interval '30 days'
group by 1
order by sessions desc, page_views desc;

-- ============================================================
-- 2) 전체 referrer 원본 URL (요약 말고 raw 로 보고 싶을 때)
-- ============================================================
select
  coalesce(nullif(metadata->>'referrer', ''), '(direct / none)') as referrer,
  count(*)                       as page_views,
  count(distinct session_id)     as sessions,
  max(created_at)                as last_seen
from public.user_events
where event_name = 'page_view'
group by 1
order by sessions desc, page_views desc
limit 100;

-- ============================================================
-- 3) UTM 캠페인별 유입 (직접 홍보 링크 추적용)
-- ============================================================
select
  coalesce(nullif(metadata->>'utm_source', ''),   '(none)') as utm_source,
  coalesce(nullif(metadata->>'utm_medium', ''),   '(none)') as utm_medium,
  coalesce(nullif(metadata->>'utm_campaign', ''), '(none)') as utm_campaign,
  count(*)                       as page_views,
  count(distinct session_id)     as sessions
from public.user_events
where event_name = 'page_view'
  and created_at >= now() - interval '30 days'
group by 1, 2, 3
order by sessions desc;

-- ============================================================
-- 4) 일자 × referrer 도메인 추이 (어느 날 어디서 터졌는지)
-- ============================================================
select
  date_trunc('day', created_at)::date as day,
  coalesce(
    nullif(
      regexp_replace(nullif(metadata->>'referrer', ''), '^https?://([^/]+).*$', '\1'),
      ''
    ),
    '(direct / none)'
  ) as referrer_host,
  count(distinct session_id) as sessions
from public.user_events
where event_name = 'page_view'
  and created_at >= now() - interval '14 days'
group by 1, 2
order by 1 desc, sessions desc;
