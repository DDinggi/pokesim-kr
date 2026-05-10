-- 적용 방법: Supabase Dashboard → SQL Editor → New query → 아래 전체 복붙 후 Run
-- 목적: 방문/클릭 퍼널 분석용 익명 이벤트. 개별 카드명/이미지 URL은 저장하지 않는다.

-- ============================================================
-- 1) user_events 테이블
-- ============================================================

create table if not exists public.user_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  event_name text not null check (
    event_name in (
      'page_view',
      'select_mode',
      'select_set',
      'open_again',
      'open_card_modal'
    )
  ),
  set_code text,
  mode text,
  rarity text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_user_events_created_at
  on public.user_events (created_at desc);

create index if not exists idx_user_events_event_created
  on public.user_events (event_name, created_at desc);

create index if not exists idx_user_events_session_created
  on public.user_events (session_id, created_at desc);

create index if not exists idx_user_events_set_created
  on public.user_events (set_code, created_at desc);

-- ============================================================
-- 2) RLS: anon insert만 허용, 직접 select/update/delete는 차단
-- ============================================================

alter table public.user_events enable row level security;

drop policy if exists "anon can insert user_events" on public.user_events;
create policy "anon can insert user_events"
  on public.user_events
  for insert
  to anon
  with check (true);

-- 의도적으로 SELECT 정책을 만들지 않음.
-- 분석은 Supabase Dashboard SQL Editor에서 owner 권한으로 실행한다.

-- ============================================================
-- 3) 분석 쿼리 예시
-- ============================================================

-- 일별 퍼널
-- select
--   date_trunc('day', created_at) as day,
--   count(distinct session_id) filter (where event_name = 'page_view') as visitors,
--   count(distinct session_id) filter (where event_name = 'select_mode') as mode_selectors,
--   count(distinct session_id) filter (where event_name = 'select_set') as set_selectors,
--   count(distinct session_id) filter (where event_name = 'open_again') as repeaters,
--   count(distinct session_id) filter (where event_name = 'open_card_modal') as card_detail_users
-- from public.user_events
-- group by 1
-- order by 1 desc;

-- 인기 세트
-- select
--   set_code,
--   count(*) filter (where event_name = 'select_set') as selected,
--   count(*) filter (where event_name = 'open_again') as repeated,
--   count(*) filter (where event_name = 'open_card_modal') as card_modal_opens
-- from public.user_events
-- where set_code is not null
-- group by set_code
-- order by selected desc;

-- 모드 선호도
-- select
--   mode,
--   count(*) as events,
--   count(distinct session_id) as users
-- from public.user_events
-- where event_name = 'select_mode'
-- group by mode
-- order by users desc;
