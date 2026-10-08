import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { VisitorStats } from '../../../lib/statsTracker';

export const dynamic = 'force-dynamic';

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
let snapshot: { value: VisitorStats; expiresAt: number } | null = null;
let pendingSnapshot: Promise<VisitorStats> | null = null;

async function loadSnapshot(url: string, secret: string): Promise<VisitorStats> {
  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [unique, first, visits, firstDay] = await Promise.all([
    supabase.from('analytics_visitors').select('visitor_id', { count: 'exact', head: true }),
    supabase.from('analytics_visitors').select('first_seen').order('first_seen', { ascending: true }).limit(1),
    // 기본키(day_kst, visitor_id)가 같은 날 재방문을 제외하고 다른 날 재방문은 더한다.
    supabase.from('analytics_user_daily_activity').select('day_kst', { count: 'exact', head: true }),
    supabase.from('analytics_user_daily_activity').select('day_kst').order('day_kst', { ascending: true }).limit(1),
  ]);
  const error = unique.error || first.error || visits.error || firstDay.error;
  if (error || unique.count === null || visits.count === null) {
    console.error('[visitor-stats] query failed', error?.code ?? 'missing-count');
    throw new Error('Visitor snapshot unavailable');
  }

  return {
    cumulativeVisits: visits.count,
    cumulativeUniqueVisitors: unique.count,
    firstObservedAt: first.data?.[0]?.first_seen ?? null,
    firstRecordedDayKst: firstDay.data?.[0]?.day_kst ?? null,
    measuredAt: new Date().toISOString(),
  };
}

function unavailable(message: string) {
  return NextResponse.json({ error: message }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secret) {
    return unavailable('방문 통계를 사용할 수 없습니다.');
  }

  try {
    if (!snapshot || snapshot.expiresAt <= Date.now()) {
      // 같은 서버의 동시 요청은 한 번의 재집계를 공유한다.
      pendingSnapshot ??= loadSnapshot(url, secret);
      const activeSnapshot = pendingSnapshot;
      try {
        const value = await activeSnapshot;
        snapshot = { value, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
      } finally {
        if (pendingSnapshot === activeSnapshot) pendingSnapshot = null;
      }
    }

    return NextResponse.json(snapshot.value, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return unavailable('방문 통계를 불러오지 못했습니다.');
  }
}
