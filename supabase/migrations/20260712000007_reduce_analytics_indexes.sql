-- Free tier recovery: analytics tables are append-only and clients never query
-- their raw rows directly. Keep primary keys and the two hot sim_events indexes,
-- remove large indexes used only by occasional owner-side analysis.

drop index if exists public.idx_user_events_session_created;
drop index if exists public.idx_user_events_set_created;
drop index if exists public.idx_user_events_event_created;
drop index if exists public.idx_user_events_created_at;

drop index if exists public.idx_sim_events_session_luck;
drop index if exists public.sim_events_created_idx;
drop index if exists public.idx_sim_events_luck_created;

-- Date-range owner queries still get a compact append-only index.
create index if not exists idx_user_events_created_at_brin
  on public.user_events using brin (created_at);
