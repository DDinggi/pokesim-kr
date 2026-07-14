begin;

-- No user id is accepted from the client: the JWT owner can only delete itself.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.users
  where id = current_user_id;

  if not found then
    raise exception 'User account not found';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;

notify pgrst, 'reload schema';