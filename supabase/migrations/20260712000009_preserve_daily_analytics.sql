-- Preserve exact daily activity independently from bounded raw event retention.
-- One visitor/session produces at most one activity row per KST day.

set session characteristics as transaction read write;
set lock_timeout = '10s';
set statement_timeout = '10min';

begin;

create table if not exists public.analytics_user_daily_activity (
  day_kst date not null,
  visitor_id text not null,
  primary key (day_kst, visitor_id)
);

create table if not exists public.analytics_user_daily (
  day_kst date primary key,
  total_events bigint not null default 0,
  page_views bigint not null default 0
);

create table if not exists public.analytics_sim_daily_sessions (
  day_kst date not null,
  session_id text not null,
  primary key (day_kst, session_id)
);

create table if not exists public.analytics_sim_daily (
  day_kst date primary key,
  total_events bigint not null default 0,
  total_boxes bigint not null default 0,
  total_packs bigint not null default 0,
  total_krw bigint not null default 0
);

alter table public.analytics_user_daily_activity enable row level security;
alter table public.analytics_user_daily enable row level security;
alter table public.analytics_sim_daily_sessions enable row level security;
alter table public.analytics_sim_daily enable row level security;

revoke all on table public.analytics_user_daily_activity from public, anon, authenticated;
revoke all on table public.analytics_user_daily from public, anon, authenticated;
revoke all on table public.analytics_sim_daily_sessions from public, anon, authenticated;
revoke all on table public.analytics_sim_daily from public, anon, authenticated;

insert into public.analytics_user_daily_activity (day_kst, visitor_id)
select distinct
  (timezone('Asia/Seoul', created_at))::date,
  metadata->>'visitor_id'
from public.user_events
where coalesce(metadata->>'visitor_id', '') not in ('', 'unknown')
on conflict do nothing;

-- The first and last observed days are still exact even if old raw rows were
-- already compacted before this migration.
insert into public.analytics_user_daily_activity (day_kst, visitor_id)
select
  (timezone('Asia/Seoul', first_seen))::date,
  visitor_id
from public.analytics_visitors
union
select
  (timezone('Asia/Seoul', last_seen))::date,
  visitor_id
from public.analytics_visitors
on conflict do nothing;

insert into public.analytics_user_daily (day_kst, total_events, page_views)
select
  (timezone('Asia/Seoul', created_at))::date,
  count(*),
  count(*) filter (where event_name = 'page_view')
from public.user_events
group by 1
on conflict (day_kst) do update
set
  total_events = excluded.total_events,
  page_views = excluded.page_views;

insert into public.analytics_sim_daily_sessions (day_kst, session_id)
select distinct
  (timezone('Asia/Seoul', created_at))::date,
  session_id
from public.sim_events
where coalesce(session_id, '') not in ('', 'unknown')
on conflict do nothing;

insert into public.analytics_sim_daily (
  day_kst,
  total_events,
  total_boxes,
  total_packs,
  total_krw
)
select
  (timezone('Asia/Seoul', created_at))::date,
  count(*),
  coalesce(sum(box_count), 0),
  coalesce(sum(pack_count), 0),
  coalesce(sum(krw), 0)
from public.sim_events
group by 1
on conflict (day_kst) do update
set
  total_events = excluded.total_events,
  total_boxes = excluded.total_boxes,
  total_packs = excluded.total_packs,
  total_krw = excluded.total_krw;

create or replace function public.capture_analytics_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tracked_visitor_id text := new.metadata->>'visitor_id';
  tracked_day date := (timezone('Asia/Seoul', new.created_at))::date;
begin
  if coalesce(tracked_visitor_id, '') not in ('', 'unknown') then
    insert into public.analytics_visitors (visitor_id, first_seen, last_seen)
    values (tracked_visitor_id, new.created_at, new.created_at)
    on conflict (visitor_id) do update
    set
      first_seen = least(analytics_visitors.first_seen, excluded.first_seen),
      last_seen = greatest(analytics_visitors.last_seen, excluded.last_seen)
    where analytics_visitors.last_seen < excluded.last_seen - interval '1 hour';

    insert into public.analytics_user_daily_activity (day_kst, visitor_id)
    values (tracked_day, tracked_visitor_id)
    on conflict do nothing;
  end if;

  insert into public.analytics_user_daily (day_kst, total_events, page_views)
  values (
    tracked_day,
    1,
    case when new.event_name = 'page_view' then 1 else 0 end
  )
  on conflict (day_kst) do update
  set
    total_events = analytics_user_daily.total_events + 1,
    page_views = analytics_user_daily.page_views + excluded.page_views;

  return new;
end;
$$;

revoke all on function public.capture_analytics_visitor() from public, anon, authenticated;

create or replace function public.capture_sim_daily_analytics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tracked_day date := (timezone('Asia/Seoul', new.created_at))::date;
begin
  if coalesce(new.session_id, '') not in ('', 'unknown') then
    insert into public.analytics_sim_daily_sessions (day_kst, session_id)
    values (tracked_day, new.session_id)
    on conflict do nothing;
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

  return new;
end;
$$;

revoke all on function public.capture_sim_daily_analytics() from public, anon, authenticated;

drop trigger if exists capture_sim_daily_analytics on public.sim_events;
create trigger capture_sim_daily_analytics
after insert on public.sim_events
for each row execute function public.capture_sim_daily_analytics();

-- Compact raw rows only after all retained history has been copied into the
-- permanent daily tables above.
select public.archive_analytics_events(14, 30);

commit;
