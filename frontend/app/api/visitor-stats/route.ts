import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secret) {
    return NextResponse.json({ error: '방문 통계를 사용할 수 없습니다.' }, { status: 503 });
  }

  const supabase = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [total, first] = await Promise.all([
    supabase.from('analytics_visitors').select('visitor_id', { count: 'exact', head: true }),
    supabase.from('analytics_visitors').select('first_seen').order('first_seen', { ascending: true }).limit(1),
  ]);
  if (total.error || first.error || total.count === null) {
    console.error('[visitor-stats] query failed', total.error?.code ?? first.error?.code);
    return NextResponse.json({ error: '방문 통계를 불러오지 못했습니다.' }, { status: 503 });
  }

  return NextResponse.json({
    cumulativeUniqueVisitors: total.count,
    firstObservedAt: first.data?.[0]?.first_seen ?? null,
    measuredAt: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
