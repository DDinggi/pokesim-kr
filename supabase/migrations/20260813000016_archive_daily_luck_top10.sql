begin;

create table if not exists public.daily_luck_leaderboard_days (
  day_kst date primary key,
  set_code text not null check (char_length(set_code) between 1 and 64),
  participant_count integer not null check (participant_count > 0),
  finalized_at timestamptz not null default now()
);

create table if not exists public.daily_luck_leaderboard_entries (
  day_kst date not null references public.daily_luck_leaderboard_days(day_kst) on delete cascade,
  rank smallint not null check (rank between 1 and 10),
  user_id uuid not null references auth.users(id) on delete cascade,
  public_name text not null check (char_length(public_name) between 1 and 20),
  score_value_krw integer not null check (score_value_krw >= 0),
  hit_card_nums text[] not null default '{}'::text[] check (cardinality(hit_card_nums) <= 3),
  primary key (day_kst, rank),
  unique (day_kst, user_id)
);

create index if not exists daily_luck_leaderboard_entries_user_idx
  on public.daily_luck_leaderboard_entries (user_id, day_kst desc);

alter table public.daily_luck_leaderboard_days enable row level security;
alter table public.daily_luck_leaderboard_entries enable row level security;

revoke all on table public.daily_luck_leaderboard_days from public, anon, authenticated;
revoke all on table public.daily_luck_leaderboard_entries from public, anon, authenticated;
grant select, insert on table public.daily_luck_leaderboard_days to service_role;
grant select, insert, delete on table public.daily_luck_leaderboard_entries to service_role;

create or replace function public.archive_daily_luck_day(p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_day date;
begin
  if p_day >= (now() at time zone 'Asia/Seoul')::date then
    return;
  end if;

  insert into public.daily_luck_leaderboard_days (
    day_kst,
    set_code,
    participant_count
  )
  select
    p_day,
    min(runs.set_code),
    count(*)::integer
  from public.daily_luck_runs as runs
  where runs.day_kst = p_day
  having count(*) > 0
  on conflict (day_kst) do nothing
  returning day_kst into inserted_day;

  if inserted_day is null then
    return;
  end if;

  insert into public.daily_luck_leaderboard_entries (
    day_kst,
    rank,
    user_id,
    public_name,
    score_value_krw,
    hit_card_nums
  )
  with ranked as (
    select
      runs.user_id,
      runs.public_name,
      runs.score_value_krw,
      runs.result,
      row_number() over (
        order by
          runs.score_value_krw desc,
          runs.score_percentile desc,
          runs.tie_breaker asc,
          runs.user_id asc
      )::smallint as rank
    from public.daily_luck_runs as runs
    where runs.day_kst = p_day
  )
  select
    p_day,
    ranked.rank,
    ranked.user_id,
    ranked.public_name,
    ranked.score_value_krw,
    array(
      select hit_card_num
      from jsonb_array_elements_text(
        coalesce(ranked.result->'hitCardNums', '[]'::jsonb)
      ) with ordinality as hits(hit_card_num, position)
      order by hits.position
      limit 3
    )
  from ranked
  where ranked.rank <= 10
  order by ranked.rank;
end;
$$;

revoke all on function public.archive_daily_luck_day(date)
  from public, anon, authenticated;
grant execute on function public.archive_daily_luck_day(date)
  to service_role;

create or replace function public.get_daily_luck_archive_snapshot(
  p_day date,
  p_user_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'participantCount', coalesce(days.participant_count, 0),
    'leaderboard', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'rank', entries.rank,
            'name', entries.public_name,
            'hitCardNums', to_jsonb(entries.hit_card_nums),
            'observedValueKrw', entries.score_value_krw,
            'isMine', entries.user_id = p_user_id
          )
          order by entries.rank
        )
        from public.daily_luck_leaderboard_entries as entries
        where entries.day_kst = p_day
      ),
      '[]'::jsonb
    ),
    'mine', null,
    'finalizedAt', days.finalized_at
  )
  from (select 1) as singleton
  left join public.daily_luck_leaderboard_days as days
    on days.day_kst = p_day;
$$;

revoke all on function public.get_daily_luck_archive_snapshot(date, uuid)
  from public, anon, authenticated;
grant execute on function public.get_daily_luck_archive_snapshot(date, uuid)
  to service_role;

create or replace function public.prune_daily_luck_runs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  archive_day date;
begin
  for archive_day in
    select distinct runs.day_kst
    from public.daily_luck_runs as runs
    where runs.day_kst < new.day_kst
      and not exists (
        select 1
        from public.daily_luck_leaderboard_days as days
        where days.day_kst = runs.day_kst
      )
  loop
    perform public.archive_daily_luck_day(archive_day);
  end loop;

  delete from public.daily_luck_runs
  where day_kst < new.day_kst - 30;
  return new;
end;
$$;

do $$
declare
  archive_day date;
begin
  for archive_day in
    select distinct runs.day_kst
    from public.daily_luck_runs as runs
    where runs.day_kst < (now() at time zone 'Asia/Seoul')::date
    order by runs.day_kst
  loop
    perform public.archive_daily_luck_day(archive_day);
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
