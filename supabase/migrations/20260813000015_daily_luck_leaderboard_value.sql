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
            'observedValueKrw', ranked.score_value_krw,
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
