import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import hitDexDefault from '../frontend/lib/hitDex.ts';
import valueLuckDefault from '../frontend/lib/valueLuck.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';
import type { HitDexEntry, HitDexState } from '../frontend/lib/hitDex.ts';

const {
  HIT_DEX_DEBUG_STORAGE_KEY,
  getHitDexCardKey,
  getSortedHitDexEntries,
  isHitDexCard,
} = hitDexDefault as unknown as typeof import('../frontend/lib/hitDex.ts');
const { getCardReferenceValueKrw } = valueLuckDefault as unknown as typeof import('../frontend/lib/valueLuck.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface SetIndex {
  active_sets: string[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadSet(code: string): SetMeta {
  return readJson<SetMeta>(resolve(ROOT_DIR, 'frontend', 'public', 'sets', `${code}.json`));
}

function buildEntry(card: Card, set: SetMeta, now: string): HitDexEntry {
  return {
    key: getHitDexCardKey(card, set.code),
    setCode: set.code,
    setNameKo: set.name_ko,
    cardNum: card.card_num,
    firstPulledAt: now,
    lastPulledAt: now,
    pullCount: 1,
    bestPriceRefKrw: getCardReferenceValueKrw(card, set.code),
    card,
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHtml(totalEntries: number, totalSets: number, builtAt: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>도감 채우기</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #030712; color: #f8fafc; }
    main { width: min(520px, calc(100vw - 32px)); border: 1px solid rgba(125, 211, 252, .18); border-radius: 22px; background: rgba(15, 23, 42, .86); padding: 24px; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
    h1 { margin: 0; font-size: 24px; letter-spacing: -0.03em; }
    p { color: #94a3b8; line-height: 1.6; }
    strong { color: #67e8f9; }
    a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; border: 0; border-radius: 12px; background: #67e8f9; color: #0f172a; padding: 0 16px; font-weight: 900; text-decoration: none; cursor: pointer; }
    .muted { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <main>
    <h1>도감 채우는 중</h1>
    <p id="status"><strong>${totalEntries.toLocaleString()}</strong>장의 힛카드를 이 브라우저 도감에 등록합니다.</p>
    <p class="muted">세트 ${totalSets.toLocaleString()}개 · 생성 시각 ${escapeHtml(builtAt)}</p>
    <a id="open" href="/?debugHitDex=full&amp;debugAuth=1">꽉 찬 도감 열기</a>
  </main>
  <script>
    const storageKey = ${JSON.stringify(HIT_DEX_DEBUG_STORAGE_KEY)};
    async function fillDex() {
      const response = await fetch('/debug/hit-dex-full-state.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('state json load failed');
      const state = await response.json();
      localStorage.setItem(storageKey, JSON.stringify(state));
      document.getElementById('status').innerHTML = '<strong>' + state.entries.length.toLocaleString() + '</strong>장 등록 완료. 곧 도감으로 이동합니다.';
      window.setTimeout(() => window.location.replace('/?debugHitDex=full&debugAuth=1'), 350);
    }
    fillDex().catch((error) => {
      document.getElementById('status').textContent = '도감 채우기 실패: ' + error.message;
    });
  </script>
</body>
</html>`;
}

const index = readJson<SetIndex>(resolve(ROOT_DIR, 'data', 'sets-index.json'));
const now = new Date().toISOString();
const entriesByKey = new Map<string, HitDexEntry>();

for (const code of index.active_sets) {
  const set = loadSet(code);
  for (const card of set.cards) {
    if (!isHitDexCard(card, set.code)) continue;
    const entry = buildEntry(card, set, now);
    entriesByKey.set(entry.key, entry);
  }
}

const state: HitDexState = {
  version: 1,
  updatedAt: now,
  entries: getSortedHitDexEntries({ version: 1, updatedAt: now, entries: Array.from(entriesByKey.values()) }),
};

const outDir = resolve(ROOT_DIR, 'frontend', 'public', 'debug');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'hit-dex-full-state.json'), JSON.stringify(state, null, 2), 'utf8');
writeFileSync(resolve(outDir, 'fill-hit-dex.html'), renderHtml(state.entries.length, index.active_sets.length, now), 'utf8');

console.log(`힛카드 도감 ${state.entries.length}장 채움 상태 생성 완료`);
console.log(`열기: http://localhost:3000/debug/fill-hit-dex.html`);
