begin;

create table if not exists public.daily_luck_runs (
  day_kst date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_code text not null check (char_length(set_code) between 1 and 64),
  seed text not null check (char_length(seed) between 1 and 128),
  public_name text not null check (char_length(public_name) between 1 and 20),
  nickname_public boolean not null default false,
  score_value_krw integer not null check (score_value_krw >= 0),
  score_percentile double precision not null check (
    score_percentile >= 0 and score_percentile <= 1
  ),
  luck_tier_score double precision not null,
  tie_breaker bigint not null check (tie_breaker >= 0),
  result jsonb not null,
  score_version smallint not null default 5 check (score_version > 0),
  created_at timestamptz not null default now(),
  primary key (day_kst, user_id)
);

alter table public.daily_luck_runs
  alter column score_version set default 5;

alter table public.daily_luck_runs
  drop constraint if exists daily_luck_runs_result_check;
alter table public.daily_luck_runs
  add constraint daily_luck_runs_result_check check (
    jsonb_typeof(result) = 'object'
    and octet_length(result::text) <= 32768
  );

create index if not exists daily_luck_runs_rank_idx
  on public.daily_luck_runs (
    day_kst,
    score_value_krw desc,
    score_percentile desc,
    tie_breaker asc
  );

alter table public.daily_luck_runs enable row level security;

-- Only the same-origin server route can read and write challenge rows.
revoke all on table public.daily_luck_runs from public, anon, authenticated;
grant select, insert, delete on table public.daily_luck_runs to service_role;

create or replace function public.get_daily_luck_snapshot(
  p_day date,
  p_user_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      runs.*,
      row_number() over (
        order by
          runs.score_value_krw desc,
          runs.score_percentile desc,
          runs.tie_breaker asc,
          runs.user_id asc
      )::integer as rank
    from public.daily_luck_runs as runs
    where runs.day_kst = p_day
  )
  select jsonb_build_object(
    'participantCount', (select count(*) from ranked),
    'leaderboard', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'rank', ranked.rank,
            'name', ranked.public_name,
            'hitCardNums', coalesce(ranked.result->'hitCardNums', '[]'::jsonb),
            'isMine', ranked.user_id = p_user_id
          )
          order by ranked.rank
        )
        from ranked
        where ranked.rank <= 10
      ),
      '[]'::jsonb
    ),
    'mine', (
      select jsonb_build_object(
        'rank', ranked.rank,
        'publicName', ranked.public_name,
        'nicknamePublic', ranked.nickname_public,
        'openedAt', ranked.created_at,
        'result', ranked.result
      )
      from ranked
      where ranked.user_id = p_user_id
    )
  );
$$;

revoke all on function public.get_daily_luck_snapshot(date, uuid)
  from public, anon, authenticated;
grant execute on function public.get_daily_luck_snapshot(date, uuid)
  to service_role;

create or replace function public.prune_daily_luck_runs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.daily_luck_runs
  where day_kst < new.day_kst - 30;
  return new;
end;
$$;

revoke all on function public.prune_daily_luck_runs()
  from public, anon, authenticated;

drop trigger if exists prune_daily_luck_runs_after_insert
  on public.daily_luck_runs;
create trigger prune_daily_luck_runs_after_insert
  after insert on public.daily_luck_runs
  for each row
  execute function public.prune_daily_luck_runs();

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
      'view_luck',
      'luck_empty_state',
      'reset_history',
      'select_luck_set',
      'expand_luck_hit_cards',
      'open_daily_luck',
      'complete_daily_luck',
      'view_daily_leaderboard',
      'open_again',
      'open_card_modal'
    )
  );

commit;

notify pgrst, 'reload schema';
