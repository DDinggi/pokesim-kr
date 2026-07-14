begin;

-- The browser uses one persisted Supabase client for both analytics and auth.
-- After login its JWT role changes from anon to authenticated, so both client
-- roles need the same append-only permission on anonymous analytics tables.
alter table public.user_events enable row level security;
alter table public.sim_events enable row level security;

drop policy if exists "anon can insert user_events" on public.user_events;
drop policy if exists "clients can insert user_events" on public.user_events;
create policy "clients can insert user_events"
  on public.user_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon can insert sim_events" on public.sim_events;
drop policy if exists "clients can insert sim_events" on public.sim_events;
create policy "clients can insert sim_events"
  on public.sim_events
  for insert
  to anon, authenticated
  with check (true);

revoke all on table public.user_events from public, anon, authenticated;
revoke all on table public.sim_events from public, anon, authenticated;
grant insert on table public.user_events to anon, authenticated;
grant insert on table public.sim_events to anon, authenticated;

do $$
declare
  sequence_name text;
begin
  sequence_name := pg_get_serial_sequence('public.user_events', 'id');
  if sequence_name is not null then
    execute format(
      'grant usage on sequence %s to anon, authenticated',
      sequence_name
    );
  end if;

  sequence_name := pg_get_serial_sequence('public.sim_events', 'id');
  if sequence_name is not null then
    execute format(
      'grant usage on sequence %s to anon, authenticated',
      sequence_name
    );
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
