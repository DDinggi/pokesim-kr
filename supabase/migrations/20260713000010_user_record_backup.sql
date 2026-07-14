begin;

create table if not exists public.user_record_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"v":1,"s":{}}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object'),
  check (octet_length(payload::text) <= 65536)
);

alter table public.user_record_backups enable row level security;

drop policy if exists "Users can read their record backup" on public.user_record_backups;
create policy "Users can read their record backup"
  on public.user_record_backups
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.user_record_backups from public, anon;
grant select on table public.user_record_backups to authenticated;

create or replace function public.save_user_record_backup(
  p_payload jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_revision bigint;
  next_revision bigint;
  source_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(coalesce(p_payload, 'null'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_payload->'s', 'null'::jsonb)) <> 'object'
    or coalesce(p_payload->>'v', '') <> '1' then
    raise exception 'Invalid record backup payload';
  end if;

  select count(*)
  into source_count
  from jsonb_object_keys(p_payload->'s');
  if source_count > 8 then
    raise exception 'Too many record sources';
  end if;

  if octet_length(p_payload::text) > 65536 then
    raise exception 'Record backup payload is too large';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select revision
  into current_revision
  from public.user_record_backups
  where user_id = current_user_id
  for update;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'record_revision_conflict';
    end if;

    insert into public.user_record_backups (user_id, payload, revision, updated_at)
    values (current_user_id, p_payload, 1, now());
    next_revision := 1;
  else
    if current_revision <> coalesce(p_expected_revision, -1) then
      raise exception 'record_revision_conflict';
    end if;

    next_revision := current_revision + 1;
    update public.user_record_backups
    set payload = p_payload, revision = next_revision, updated_at = now()
    where user_id = current_user_id;
  end if;

  return jsonb_build_object('payload', p_payload, 'revision', next_revision);
end;
$$;

revoke all on function public.save_user_record_backup(jsonb, bigint) from public, anon;
grant execute on function public.save_user_record_backup(jsonb, bigint) to authenticated;

commit;

-- PostgREST can keep the old RPC signature until its schema cache is reloaded.
notify pgrst, 'reload schema';
