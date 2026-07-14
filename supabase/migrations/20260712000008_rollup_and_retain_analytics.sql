-- Preserve lifetime counters while bounding append-only analytics tables.
-- sim_events keeps 14 days; user_events keeps 30 days for recent diagnostics.

set session characteristics as transaction read write;
set lock_timeout = '10s';
set statement_timeout = '10min';

begin;

create table if not exists public.analytics_sim_archive (
  singleton boolean primary key default true check (singleton),
  total_sessions bigint not null default 0,
  total_events bigint not null default 0,
  total_packs bigint not null default 0,
  total_boxes bigint not null default 0,
  total_krw bigint not null default 0,
  last_archived_at timestamptz
);

insert into public.analytics_sim_archive (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.analytics_user_archive (
  singleton boolean primary key default true check (singleton),
  total_sessions bigint not null default 0,
  total_events bigint not null default 0,
  total_page_views bigint not null default 0,
  last_archived_at timestamptz
);

insert into public.analytics_user_archive (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.analytics_visitors (
  visitor_id text primary key,
  first_seen timestamptz not null,
  last_seen timestamptz not null
);

alter table public.analytics_sim_archive enable row level security;
alter table public.analytics_user_archive enable row level security;
alter table public.analytics_visitors enable row level security;

revoke all on table public.analytics_sim_archive from public, anon, authenticated;
revoke all on table public.analytics_user_archive from public, anon, authenticated;
revoke all on table public.analytics_visitors from public, anon, authenticated;

insert into public.analytics_visitors (visitor_id, first_seen, last_seen)
select
  metadata->>'visitor_id',
  min(created_at),
  max(created_at)
from public.user_events
where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
group by metadata->>'visitor_id'
on conflict (visitor_id) do update
set
  first_seen = least(analytics_visitors.first_seen, excluded.first_seen),
  last_seen = greatest(analytics_visitors.last_seen, excluded.last_seen);

create or replace function public.capture_analytics_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tracked_visitor_id text := new.metadata->>'visitor_id';
begin
  if coalesce(tracked_visitor_id, '') not in ('', 'unknown') then
    insert into public.analytics_visitors (visitor_id, first_seen, last_seen)
    values (tracked_visitor_id, new.created_at, new.created_at)
    on conflict (visitor_id) do update
    set
      first_seen = least(analytics_visitors.first_seen, excluded.first_seen),
      last_seen = greatest(analytics_visitors.last_seen, excluded.last_seen)
    where analytics_visitors.last_seen < excluded.last_seen - interval '1 hour';
  end if;

  return new;
end;
$$;

revoke all on function public.capture_analytics_visitor() from public, anon, authenticated;

drop trigger if exists capture_analytics_visitor on public.user_events;
create trigger capture_analytics_visitor
after insert on public.user_events
for each row execute function public.capture_analytics_visitor();

create or replace function public.archive_analytics_events(
  sim_retention_days integer default 14,
  user_retention_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sim_cutoff timestamptz;
  user_cutoff timestamptz;
  archived_sim_rows bigint := 0;
  archived_sim_sessions bigint := 0;
  archived_packs bigint := 0;
  archived_boxes bigint := 0;
  archived_krw bigint := 0;
  archived_user_rows bigint := 0;
  archived_user_sessions bigint := 0;
  archived_page_views bigint := 0;
  deleted_sim_rows bigint := 0;
  deleted_user_rows bigint := 0;
begin
  if sim_retention_days < 7 or user_retention_days < 14 then
    raise exception 'retention is too short: sim %, user %',
      sim_retention_days, user_retention_days;
  end if;

  sim_cutoff :=
    (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
    - make_interval(days => sim_retention_days);
  user_cutoff :=
    (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
    - make_interval(days => user_retention_days);

  select
    count(*),
    count(distinct session_id),
    coalesce(sum(pack_count), 0)::bigint,
    coalesce(sum(box_count), 0)::bigint,
    coalesce(sum(krw), 0)::bigint
  into
    archived_sim_rows,
    archived_sim_sessions,
    archived_packs,
    archived_boxes,
    archived_krw
  from public.sim_events
  where created_at < sim_cutoff;

  if archived_sim_rows > 0 then
    update public.analytics_sim_archive
    set
      total_sessions = total_sessions + archived_sim_sessions,
      total_events = total_events + archived_sim_rows,
      total_packs = total_packs + archived_packs,
      total_boxes = total_boxes + archived_boxes,
      total_krw = total_krw + archived_krw,
      last_archived_at = now()
    where singleton;

    delete from public.sim_events
    where created_at < sim_cutoff;
    get diagnostics deleted_sim_rows = row_count;
  end if;

  insert into public.analytics_visitors (visitor_id, first_seen, last_seen)
  select
    metadata->>'visitor_id',
    min(created_at),
    max(created_at)
  from public.user_events
  where created_at < user_cutoff
    and coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
  group by metadata->>'visitor_id'
  on conflict (visitor_id) do update
  set
    first_seen = least(analytics_visitors.first_seen, excluded.first_seen),
    last_seen = greatest(analytics_visitors.last_seen, excluded.last_seen);

  select
    count(*),
    count(distinct session_id),
    count(*) filter (where event_name = 'page_view')
  into
    archived_user_rows,
    archived_user_sessions,
    archived_page_views
  from public.user_events
  where created_at < user_cutoff;

  if archived_user_rows > 0 then
    update public.analytics_user_archive
    set
      total_sessions = total_sessions + archived_user_sessions,
      total_events = total_events + archived_user_rows,
      total_page_views = total_page_views + archived_page_views,
      last_archived_at = now()
    where singleton;

    delete from public.user_events
    where created_at < user_cutoff;
    get diagnostics deleted_user_rows = row_count;
  end if;

  return jsonb_build_object(
    'sim_cutoff', sim_cutoff,
    'user_cutoff', user_cutoff,
    'archived_sim_rows', archived_sim_rows,
    'deleted_sim_rows', deleted_sim_rows,
    'archived_user_rows', archived_user_rows,
    'deleted_user_rows', deleted_user_rows
  );
end;
$$;

revoke all on function public.archive_analytics_events(integer, integer)
  from public, anon, authenticated;

create or replace function public.get_global_stats()
returns json
language sql
security definer
set search_path = public
as $$
  with current_stats as (
    select
      count(distinct session_id)::bigint as total_sessions,
      coalesce(count(*), 0)::bigint as total_events,
      coalesce(sum(pack_count), 0)::bigint as total_packs,
      coalesce(sum(box_count), 0)::bigint as total_boxes,
      coalesce(sum(krw), 0)::bigint as total_krw
    from public.sim_events
  )
  select json_build_object(
    'totalSessions', archive.total_sessions + current_stats.total_sessions,
    'totalEvents', archive.total_events + current_stats.total_events,
    'totalPacks', archive.total_packs + current_stats.total_packs,
    'totalBoxes', archive.total_boxes + current_stats.total_boxes,
    'totalKrw', archive.total_krw + current_stats.total_krw
  )
  from public.analytics_sim_archive as archive
  cross join current_stats
  where archive.singleton;
$$;

revoke all on function public.get_global_stats() from public;
grant execute on function public.get_global_stats() to anon, authenticated;

commit;
