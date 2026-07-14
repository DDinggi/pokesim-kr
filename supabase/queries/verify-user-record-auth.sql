-- 선택형 내 기록과 계정 탈퇴 기능을 운영 적용한 뒤 Supabase SQL Editor에서 실행한다.
-- 실제 사용자 데이터는 출력하지 않고 객체·권한·정책의 존재만 확인한다.

select
  to_regclass('public.user_record_backups') as backup_table,
  to_regprocedure('public.save_user_record_backup(jsonb,bigint)') as save_rpc,
  to_regprocedure('public.delete_my_account()') as delete_rpc;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'user_record_backups'
order by policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_record_backups';

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('save_user_record_backup', 'delete_my_account')
order by p.proname;
