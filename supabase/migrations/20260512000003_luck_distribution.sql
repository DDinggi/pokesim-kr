-- Collect luck-result data for future user-distribution features.
-- Apply in Supabase SQL Editor, or with `supabase db push`.

alter table public.sim_events
  add column if not exists top_count integer not null default 0,
  add column if not exists sar_count integer not null default 0,
  add column if not exists top_expected numeric not null default 0,
  add column if not exists sar_expected numeric not null default 0;

create index if not exists idx_sim_events_luck_created
  on public.sim_events (created_at desc)
  where top_expected > 0
     or sar_expected > 0
     or top_count > 0
     or sar_count > 0;

create index if not exists idx_sim_events_session_luck
  on public.sim_events (session_id, created_at desc);
