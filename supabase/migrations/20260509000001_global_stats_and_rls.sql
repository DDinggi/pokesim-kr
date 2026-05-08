-- 적용 방법: Supabase Dashboard → SQL Editor → New query → 아래 전체 복붙 후 Run
-- 또는 Supabase CLI 설치 시: `supabase db push`

-- ============================================================
-- 1) sim_events 테이블에 RLS 활성화 + anon insert만 허용
-- ============================================================
-- anon key는 NEXT_PUBLIC으로 브라우저에 노출되므로,
-- RLS로 권한을 좁혀야 한다.
-- - INSERT: 익명 사용자가 시뮬 결과 기록 (허용)
-- - SELECT: 직접 조회 차단. 집계는 get_global_stats() RPC로만.
-- - UPDATE/DELETE: 차단 (별도 정책 없음 = deny by default)

alter table public.sim_events enable row level security;

drop policy if exists "anon can insert sim_events" on public.sim_events;
create policy "anon can insert sim_events"
  on public.sim_events
  for insert
  to anon
  with check (true);

-- (의도적으로 select 정책을 만들지 않음 — RLS 활성 + 정책 없음 = 거부)

-- ============================================================
-- 2) get_global_stats() RPC — 서버에서 집계
-- ============================================================
-- 이전: 클라이언트가 모든 row를 fetch 후 reduce. row 수에 비례해 egress 폭증.
-- 변경: DB에서 한 번에 집계. 응답은 JSON 한 객체 (~100B).
-- security definer + 명시적 권한 부여로 anon이 호출 가능.

create or replace function public.get_global_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'totalSessions', coalesce(count(distinct session_id), 0),
    'totalPacks',    coalesce(sum(pack_count), 0),
    'totalBoxes',    coalesce(sum(box_count), 0),
    'totalKrw',      coalesce(sum(krw), 0)
  )
  from public.sim_events;
$$;

revoke all on function public.get_global_stats() from public;
grant execute on function public.get_global_stats() to anon, authenticated;

-- ============================================================
-- 3) 검증 쿼리 (실행 후 결과 확인용)
-- ============================================================
-- select public.get_global_stats();
-- → {"totalSessions":N,"totalPacks":N,"totalBoxes":N,"totalKrw":N}
