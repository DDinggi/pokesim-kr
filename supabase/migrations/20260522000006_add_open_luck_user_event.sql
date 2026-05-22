-- 내 운 확인 진입률 집계용 이벤트 추가.
-- 기존 테이블은 event_name 체크 제약으로 허용 이벤트를 제한하므로 제약을 갱신한다.

alter table public.user_events
  drop constraint if exists user_events_event_name_check;

alter table public.user_events
  add constraint user_events_event_name_check
  check (
    event_name in (
      'page_view',
      'select_mode',
      'select_set',
      'open_luck',
      'open_again',
      'open_card_modal'
    )
  );

-- 사용량 확인 예시:
-- select
--   date_trunc('day', created_at) as day,
--   count(*) as opens,
--   count(distinct session_id) as users
-- from public.user_events
-- where event_name = 'open_luck'
-- group by 1
-- order by 1 desc;
