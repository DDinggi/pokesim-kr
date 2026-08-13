import { NextResponse } from 'next/server';
import {
  DailyLuckError,
  getDailyLuckSnapshot,
  openDailyLuck,
  readBearerToken,
} from '../../../lib/dailyLuckServer';

export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof DailyLuckError) {
    return json({ error: error.message }, error.status);
  }

  console.error('[daily-luck] unexpected error', error);
  return json({ error: '오늘의 운을 처리하는 중 문제가 발생했습니다.' }, 500);
}

export async function GET(request: Request) {
  try {
    const day = new URL(request.url).searchParams.get('day');
    return json(await getDailyLuckSnapshot(readBearerToken(request), day));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return json(await openDailyLuck(readBearerToken(request), body));
  } catch (error) {
    return errorResponse(error);
  }
}
