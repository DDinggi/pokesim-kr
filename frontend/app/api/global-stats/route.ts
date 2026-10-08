import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FIELDS = ['totalSessions', 'totalPacks', 'totalBoxes', 'totalKrw'] as const;

function unavailable() {
  return NextResponse.json({ error: '개봉 통계를 불러오지 못했습니다.' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return unavailable();

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Singleton 캐시를 읽는 공개 RPC. 원본 이벤트·사용자 ID는 조회하지 않는다.
    const { data, error } = await supabase.rpc('get_global_stats');
    if (error || !data) return unavailable();

    const totals: Record<string, number> = {};
    for (const field of FIELDS) {
      const raw: unknown = data[field];
      if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) return unavailable();
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < 0) return unavailable();
      totals[field] = value;
    }

    return NextResponse.json(totals, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return unavailable();
  }
}
