/** Offline tests: no network requests, credentials, or database writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const frontendRequire = createRequire(path.join(root, 'frontend/package.json'));
const ts = frontendRequire('typescript');

function load(file, customRequire = frontendRequire) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(customRequire, mod, mod.exports);
  return mod.exports;
}

async function main() {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260712000009_preserve_daily_analytics.sql'), 'utf8');
  assert(migration.includes('primary key (day_kst, visitor_id)'));
  assert.match(migration, /insert into public\.analytics_user_daily_activity \(day_kst, visitor_id\)[\s\S]*?on conflict do nothing;/);
  assert(migration.includes("timezone('Asia/Seoul', new.created_at)"));

  const visitors = {
    cumulativeVisits: 37_876,
    cumulativeUniqueVisitors: 19_347,
    firstObservedAt: '2026-05-28T15:47:03Z',
    firstRecordedDayKst: '2026-05-29',
    measuredAt: '2026-10-08T15:58:24Z',
  };
  const stats = { totalSessions: 36_809, totalPacks: 42_075_225, totalBoxes: 1_790_603, totalKrw: 82_601_113_400 };
  const React = frontendRequire('react');
  const { renderToStaticMarkup } = frontendRequire('react-dom/server');
  const SiteStats = load('frontend/components/site-stats.tsx').default;
  const html = renderToStaticMarkup(React.createElement(SiteStats, { stats, visitorStats: visitors }));
  assert(html.includes('37,876'));
  assert(html.includes('회</span>'));
  assert(!html.includes('19,347'));
  assert(!html.includes('<details'));
  assert.equal((html.match(/<dt /g) || []).length, 3);
  for (const [partialStats, partialVisitors] of [[null, visitors], [stats, null], [null, null]]) {
    const partial = renderToStaticMarkup(React.createElement(SiteStats, { stats: partialStats, visitorStats: partialVisitors }));
    assert.equal((partial.match(/<dt /g) || []).length, 3);
    assert(partial.includes('—'));
  }

  const tracker = load('frontend/lib/statsTracker.ts', (name) => name === './supabase' ? { supabase: null } : frontendRequire(name));
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      assert.equal(url, '/api/visitor-stats?metric=daily-visits');
      return { ok: true, json: async () => visitors };
    };
    assert.deepEqual(await tracker.fetchVisitorStats(), visitors);
    for (const data of [{ ...visitors, cumulativeVisits: -1 }, { ...visitors, cumulativeVisits: undefined }]) {
      global.fetch = async () => ({ ok: true, json: async () => data });
      assert.equal(await tracker.fetchVisitorStats(), null);
    }
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal(await tracker.fetchVisitorStats(), null);
  } finally {
    global.fetch = originalFetch;
  }

  let queries = 0;
  let visits = 37_876;
  let fail = false;
  const client = {
    from(table) {
      assert(['analytics_visitors', 'analytics_user_daily_activity'].includes(table));
      return {
        select(field, options) {
          queries++;
          if (options?.head) {
            assert.equal(options.count, 'exact');
            return Promise.resolve({ count: fail ? null : table === 'analytics_visitors' ? 19_347 : visits, error: null });
          }
          return { order: () => ({ limit: async () => ({ data: [{ [field]: table === 'analytics_visitors' ? visitors.firstObservedAt : visitors.firstRecordedDayKst }], error: null }) }) };
        },
      };
    },
  };
  const route = load('frontend/app/api/visitor-stats/route.ts', (name) => name === '@supabase/supabase-js'
    ? { createClient: () => client }
    : frontendRequire(name));
  const envKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const originalNow = Date.now;
  let now = originalNow();
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
    process.env.SUPABASE_SECRET_KEY = 'test-only-key';
    Date.now = () => now;
    const responses = await Promise.all(Array.from({ length: 10 }, () => route.GET()));
    assert.equal(queries, 4, 'concurrent requests share one snapshot');
    const first = await responses[0].json();
    assert.equal(first.cumulativeVisits, 37_876);
    assert.equal(first.cumulativeUniqueVisitors, 19_347);
    assert.deepEqual(Object.keys(first).sort(), Object.keys(visitors).sort(), 'public response contains only counts/dates');
    assert.equal(responses[0].headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert(responses[0].headers.get('Cache-Control').includes('max-age=300'));
    await route.GET();
    assert.equal(queries, 4, 'cached snapshot avoids another database count');

    visits++;
    now += 5 * 60 * 1000 + 1;
    assert.equal((await (await route.GET()).json()).cumulativeVisits, 37_877);
    assert.equal(queries, 8, 'expired snapshot is recounted');
    fail = true;
    now += 5 * 60 * 1000 + 1;
    const failed = await route.GET();
    assert.equal(failed.status, 503);
    assert.equal(failed.headers.get('Cache-Control'), 'no-store');
    fail = false;
    assert.equal((await route.GET()).status, 200, 'failed snapshots can be retried');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal((await route.GET()).status, 503, 'missing configuration never exposes cached data');
  } finally {
    Date.now = originalNow;
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  }
  console.log('PASS: daily visit metric, UI units, partial data, response allowlist, cache/concurrency, expiry and retry');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
