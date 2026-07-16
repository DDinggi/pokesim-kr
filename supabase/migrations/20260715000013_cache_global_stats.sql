-- Cache lifetime simulation counters so the public stats RPC never scans the
-- retained sim_events table on a user request.

set session characteristics as transaction read write;
set lock_timeout = '10s';
set statement_timeout = '10min';

begin;

create table if not exists public.analytics_global_stats (
  singleton boolean primary key default true check (singleton),
  total_sessions bigint not null default 0,
  total_events bigint not null default 0,
  total_packs bigint not null default 0,
  total_boxes bigint not null default 0,
  total_krw bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.analytics_global_stats enable row level security;
revoke all on table public.analytics_global_stats from public, anon, authenticated;

-- Block inserts only while the existing lifetime total is copied and the
-- trigger is replaced. Rows committed before the lock are in the baseline;
-- rows committed after it are counted by the new trigger.
lock table public.sim_events in share row exclusive mode;

insert into public.analytics_global_stats (
  singleton,
  total_sessions,
  total_events,
  total_packs,
  total_boxes,
  total_krw,
  updated_at
)
with current_stats as (
  select
    count(distinct session_id)::bigint as total_sessions,
    count(*)::bigint as total_events,
    coalesce(sum(pack_count), 0)::bigint as total_packs,
    coalesce(sum(box_count), 0)::bigint as total_boxes,
    coalesce(sum(krw), 0)::bigint as total_krw
  from public.sim_events
)
select
  true,
  archive.total_sessions + current_stats.total_sessions,
  archive.total_events + current_stats.total_events,
  archive.total_packs + current_stats.total_packs,
  archive.total_boxes + current_stats.total_boxes,
  archive.total_krw + current_stats.total_krw,
  now()
from public.analytics_sim_archive as archive
cross join current_stats
where archive.singleton
  and not exists (
    select 1
    from public.analytics_global_stats
    where singleton
  )
on conflict (singleton) do nothing;

create or replace function public.capture_sim_daily_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tracked_day date := (timezone('Asia/Seoul', new.created_at))::date;
  inserted_sessions bigint := 0;
begin
  if coalesce(new.session_id, '') not in ('', 'unknown') then
    insert into public.analytics_sim_daily_sessions (day_kst, session_id)
    values (tracked_day, new.session_id)
    on conflict do nothing;

    get diagnostics inserted_sessions = row_count;
  end if;

  insert into public.analytics_sim_daily (
    day_kst,
    total_events,
    total_boxes,
    total_packs,
    total_krw
  )
  values (
    tracked_day,
    1,
    coalesce(new.box_count, 0),
    coalesce(new.pack_count, 0),
    coalesce(new.krw, 0)
  )
  on conflict (day_kst) do update
  set
    total_events = analytics_sim_daily.total_events + 1,
    total_boxes = analytics_sim_daily.total_boxes + excluded.total_boxes,
    total_packs = analytics_sim_daily.total_packs + excluded.total_packs,
    total_krw = analytics_sim_daily.total_krw + excluded.total_krw;

  insert into public.analytics_global_stats (
    singleton,
    total_sessions,
    total_events,
    total_packs,
    total_boxes,
    total_krw,
    updated_at
  )
  values (
    true,
    inserted_sessions,
    1,
    coalesce(new.pack_count, 0),
    coalesce(new.box_count, 0),
    coalesce(new.krw, 0),
    now()
  )
  on conflict (singleton) do update
  set
    total_sessions = analytics_global_stats.total_sessions + excluded.total_sessions,
    total_events = analytics_global_stats.total_events + 1,
    total_packs = analytics_global_stats.total_packs + excluded.total_packs,
    total_boxes = analytics_global_stats.total_boxes + excluded.total_boxes,
    total_krw = analytics_global_stats.total_krw + excluded.total_krw,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.capture_sim_daily_analytics()
  from public, anon, authenticated;

create or replace function public.get_global_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'totalSessions', total_sessions,
    'totalEvents', total_events,
    'totalPacks', total_packs,
    'totalBoxes', total_boxes,
    'totalKrw', total_krw
  )
  from public.analytics_global_stats
  where singleton;
$$;

revoke all on function public.get_global_stats() from public;
grant execute on function public.get_global_stats() to anon, authenticated;

commit;

notify pgrst, 'reload schema';