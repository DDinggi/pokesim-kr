import { supabase } from './supabase';
import type { LuckEventSummary } from './luck';

const SESSION_ID_KEY = 'pokesim-session-id';

export type UserEventName =
  | 'page_view'
  | 'select_mode'
  | 'select_set'
  | 'open_again'
  | 'open_card_modal';

// 하루 단위로 갱신되는 익명 세션 ID — DAU 집계용
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const today = new Date().toISOString().slice(0, 10);
  try {
    const stored = localStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { id: string; date: string };
      if (parsed.date === today) return parsed.id;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, JSON.stringify({ id, date: today }));
    return id;
  } catch {
    return 'unknown';
  }
}

export async function trackSim(event: {
  setCode: string;
  mode: 'box' | 'pack';
  boxCount: number;
  packCount: number;
  krw: number;
  luck?: LuckEventSummary;
}) {
  if (!supabase) return;
  const basePayload = {
    session_id: getSessionId(),
    set_code: event.setCode,
    mode: event.mode,
    box_count: event.boxCount,
    pack_count: event.packCount,
    krw: event.krw,
  };
  const payload = {
    ...basePayload,
    top_count: event.luck?.topCount ?? 0,
    sar_count: event.luck?.sarCount ?? 0,
    top_expected: event.luck?.topExpected ?? 0,
    sar_expected: event.luck?.sarExpected ?? 0,
  };
  const { error } = await supabase.from('sim_events').insert(payload);
  if (error && event.luck && String(error.message).includes('column')) {
    const retry = await supabase.from('sim_events').insert(basePayload);
    if (!retry.error) return;
  }
  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[analytics] sim_events insert failed', error);
  }
}

export function trackUserEvent(event: {
  eventName: UserEventName;
  setCode?: string;
  mode?: 'box' | 'vending' | 'pack';
  rarity?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  if (!supabase) return;
  void supabase
    .from('user_events')
    .insert({
      session_id: getSessionId(),
      event_name: event.eventName,
      set_code: event.setCode ?? null,
      mode: event.mode ?? null,
      rarity: event.rarity ?? null,
      metadata: event.metadata ?? {},
    })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== 'production') {
        console.warn('[analytics] user_events insert failed', error);
      }
    });
}

export interface GlobalStats {
  totalSessions: number;
  totalPacks: number;
  totalBoxes: number;
  totalKrw: number;
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  if (!supabase) return null;
  // get_global_stats RPC: 서버에서 COUNT/SUM 집계. row 수와 무관하게 응답 ~100B.
  // RLS로 sim_events 직접 SELECT는 차단됨.
  const { data, error } = await supabase.rpc('get_global_stats');
  if (error || !data) return null;
  const r = data as { totalSessions: number; totalPacks: number; totalBoxes: number; totalKrw: number };
  return {
    totalSessions: Number(r.totalSessions) || 0,
    totalPacks: Number(r.totalPacks) || 0,
    totalBoxes: Number(r.totalBoxes) || 0,
    totalKrw: Number(r.totalKrw) || 0,
  };
}

// 포아송 CDF — 세션 운 지수 계산용
function poissonCDF(k: number, lambda: number): number {
  if (lambda <= 0) return k >= 0 ? 1 : 0;
  let sum = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    sum += term;
    term *= lambda / (i + 1);
  }
  return Math.min(sum, 1);
}

/**
 * Luck percentile from the set-specific expected hit count.
 * Calculate the expected value with `summarizeLuckEvent` in `luck.ts` first.
 */
export function calcLuckPercentile(
  observedHits: number,
  expectedHits: number,
): { percentile: number; isLucky: boolean } | null {
  if (expectedHits < 0.5) return null;
  const isLucky = observedHits >= expectedHits;
  const prob = isLucky
    ? 1 - poissonCDF(Math.max(observedHits - 1, 0), expectedHits)
    : poissonCDF(observedHits, expectedHits);
  const percentile = Math.round(Math.max(1, Math.min(99, prob * 100)));
  return { percentile, isLucky };
}
