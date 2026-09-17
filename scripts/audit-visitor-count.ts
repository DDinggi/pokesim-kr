#!/usr/bin/env tsx
/** Read-only lifetime visitor audit. Never exports visitor IDs or credentials. */
import { resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dirname, '..');
config({ path: resolve(root, '.env'), quiet: true });
config({ path: resolve(root, 'frontend/.env.local'), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase URL and server secret are required');

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const tableUrl = new URL(`${url}/rest/v1/analytics_visitors`);

async function countVisitors(from?: string, until?: string, field: 'first_seen' | 'last_seen' = 'first_seen'): Promise<number> {
  const requestUrl = new URL(tableUrl);
  requestUrl.searchParams.set('select', 'visitor_id');
  if (from) requestUrl.searchParams.set(field, `gte.${from}`);
  if (until) requestUrl.searchParams.set('and', `(${field}.lt.${until})`);
  const response = await fetch(requestUrl, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } });
  if (!response.ok) throw new Error(`Visitor count request failed: HTTP ${response.status}`);
  const count = Number(response.headers.get('content-range')?.split('/').at(-1));
  if (!Number.isSafeInteger(count)) throw new Error('Supabase did not return an exact count');
  return count;
}

async function firstSeen(): Promise<string | null> {
  const requestUrl = new URL(tableUrl);
  requestUrl.searchParams.set('select', 'first_seen');
  requestUrl.searchParams.set('order', 'first_seen.asc');
  requestUrl.searchParams.set('limit', '1');
  const response = await fetch(requestUrl, { headers });
  if (!response.ok) throw new Error(`First visit request failed: HTTP ${response.status}`);
  const rows = await response.json() as Array<{ first_seen: string }>;
  return rows[0]?.first_seen ?? null;
}

async function countSimulationSessions(): Promise<number> {
  const response = await fetch(`${url}/rest/v1/rpc/get_global_stats`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`Simulation stats request failed: HTTP ${response.status}`);
  const result = await response.json() as { totalSessions?: number };
  if (!Number.isSafeInteger(result.totalSessions)) throw new Error('Invalid simulation session count');
  return result.totalSessions!;
}

function kstDay(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

const measuredAt = new Date();
const total = await countVisitors();
const earliest = await firstSeen();
const today = kstDay(measuredAt);
const recentStart = new Date(measuredAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
const recentNew = await countVisitors(recentStart);
const recentActive = await countVisitors(recentStart, undefined, 'last_seen');
const simulationSessionDays = await countSimulationSessions();
const months: Array<{ monthKst: string; firstSeenVisitors: number }> = [];
if (earliest) {
  const firstDay = kstDay(new Date(earliest));
  let year = Number(firstDay.slice(0, 4));
  let month = Number(firstDay.slice(5, 7));
  while (year * 12 + month <= Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7))) {
    const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`).toISOString();
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`).toISOString();
    months.push({ monthKst: `${year}-${String(month).padStart(2, '0')}`, firstSeenVisitors: await countVisitors(start, end) });
    year = nextYear;
    month = nextMonth;
  }
}

console.log(JSON.stringify({ measuredAt: measuredAt.toISOString(), firstObservedAt: earliest, cumulativeVisitorIds: total, activeVisitorIdsLast30Days: recentActive, newVisitorIdsLast30Days: recentNew, simulationSessionDays, firstSeenByMonthKst: months }, null, 2));
