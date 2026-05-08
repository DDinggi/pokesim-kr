import { supabase } from './supabase';

const SESSION_ID_KEY = 'pokesim-session-id';

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
}) {
  if (!supabase) return;
  await supabase.from('sim_events').insert({
    session_id: getSessionId(),
    set_code: event.setCode,
    mode: event.mode,
    box_count: event.boxCount,
    pack_count: event.packCount,
    krw: event.krw,
  });
}

export interface GlobalStats {
  totalSessions: number;
  totalBoxes: number;
  totalKrw: number;
}

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('sim_events')
    .select('session_id, box_count, krw');
  if (error || !data) return null;
  return {
    totalSessions: new Set(data.map((r) => r.session_id)).size,
    totalBoxes: data.reduce((s, r) => s + (r.box_count as number), 0),
    totalKrw: data.reduce((s, r) => s + (r.krw as number), 0),
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
 * 세션 SAR/UR/BWR 행운 지수 계산
 * @returns { percentile: 0-100, isLucky: bool }
 *   percentile: 상위 X% 또는 하위 X%의 X값
 *   isLucky: true → 상위, false → 하위
 */
export function calcLuckPercentile(
  observedHits: number,
  boxes: number,
  singlePacks: number,
): { percentile: number; isLucky: boolean } | null {
  const totalPacks = boxes * 30 + singlePacks; // 팩 수 근사 (박스는 30팩 기준)
  if (totalPacks < 5) return null; // 샘플 너무 적음
  // 박스당 SAR/UR/BWR 기대값 ≈ 0.37 (SV 기본), 단일팩 ≈ 1.1%
  const expectedHits = boxes * 0.37 + singlePacks * 0.011;
  if (expectedHits < 0.5) return null;
  const isLucky = observedHits >= expectedHits;
  // 운 좋음: P(X ≥ k) = 1 - CDF(k-1)
  // 운 없음: P(X ≤ k) = CDF(k)
  const prob = isLucky
    ? 1 - poissonCDF(Math.max(observedHits - 1, 0), expectedHits)
    : poissonCDF(observedHits, expectedHits);
  const percentile = Math.round(Math.max(1, Math.min(99, prob * 100)));
  return { percentile, isLucky };
}
