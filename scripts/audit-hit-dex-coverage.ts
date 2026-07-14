import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import hitDexDefault from '../frontend/lib/hitDex.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import simulatorDefault from '../frontend/lib/simulator.ts';
import starterDefault from '../frontend/lib/simulation/starter.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';

const { getHitDexCardKey, isHitDexCard } = hitDexDefault as unknown as typeof import('../frontend/lib/hitDex.ts');
const { rarityLabel, sortRarityKeys } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { simulateStartDeck } = starterDefault as unknown as typeof import('../frontend/lib/simulation/starter.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TRIALS = 1000;

interface SetIndex {
  active_sets: string[];
}

interface SeenHit {
  card: Card;
  count: number;
  firstOpening: number;
}

interface MissingHit {
  key: string;
  card: Card;
  rarity: string;
  unreachableByStarterRefs: boolean;
}

interface SetReport {
  code: string;
  name: string;
  type: string;
  trials: number;
  targetCount: number;
  seenCount: number;
  missingCount: number;
  completionPct: number;
  totalHitPulls: number;
  targetRarityCounts: Record<string, number>;
  seenRarityCounts: Record<string, number>;
  zeroSeenRarities: string[];
  missing: MissingHit[];
  warnings: string[];
}

function argValue(name: string, fallback?: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadSet(code: string): SetMeta {
  return readJson<SetMeta>(resolve(ROOT_DIR, 'frontend', 'public', 'sets', `${code}.json`));
}

function flattenBoxCards(set: SetMeta, trialIndex: number): Card[] {
  const result = simulateBox(
    set.cards,
    set.box_size,
    set.type,
    set.pack_size,
    `hit-dex-audit:${set.code}:box:${trialIndex}`,
    set.code,
  );
  return result.packs.flatMap((pack) => pack.cards);
}

function drawOpeningCards(set: SetMeta, trialIndex: number): Card[] {
  if (set.type === 'starter') {
    if (!set.start_deck) return [];
    return simulateStartDeck(set.cards, set.start_deck, `hit-dex-audit:${set.code}:starter:${trialIndex}`).cards;
  }

  return flattenBoxCards(set, trialIndex);
}

function starterReachableCardNums(set: SetMeta): Set<string> {
  const meta = set.start_deck;
  if (!meta) return new Set();
  return new Set([
    ...meta.rep_card_nums,
    ...meta.special_rep_card_nums,
    ...(meta.gold_rep_card_nums ?? []),
  ]);
}

function displayRarity(card: Card, setCode: string): string {
  return card.rarity ? rarityLabel(card.rarity, setCode) : '기타';
}

function inc(record: Record<string, number>, key: string, by = 1): void {
  record[key] = (record[key] ?? 0) + by;
}

function sortedRarityRecord(record: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of sortRarityKeys(Object.keys(record))) result[key] = record[key];
  return result;
}

function auditSet(set: SetMeta, trials: number): SetReport {
  const targetCards = set.cards.filter((card) => isHitDexCard(card, set.code));
  const targetsByKey = new Map(targetCards.map((card) => [getHitDexCardKey(card, set.code), card]));
  const seen = new Map<string, SeenHit>();
  const targetRarityCounts: Record<string, number> = {};
  const seenRarityCounts: Record<string, number> = {};
  const warnings: string[] = [];
  let totalHitPulls = 0;

  for (const card of targetCards) inc(targetRarityCounts, displayRarity(card, set.code));

  for (let i = 0; i < trials; i++) {
    for (const card of drawOpeningCards(set, i)) {
      if (!isHitDexCard(card, set.code)) continue;

      totalHitPulls += 1;
      const key = getHitDexCardKey(card, set.code);
      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(key, { card, count: 1, firstOpening: i + 1 });
      }
    }
  }

  for (const hit of seen.values()) inc(seenRarityCounts, displayRarity(hit.card, set.code));

  const reachableStarterNums = set.type === 'starter' ? starterReachableCardNums(set) : null;
  const missing = targetCards
    .filter((card) => !seen.has(getHitDexCardKey(card, set.code)))
    .map((card) => ({
      key: getHitDexCardKey(card, set.code),
      card,
      rarity: displayRarity(card, set.code),
      unreachableByStarterRefs: Boolean(reachableStarterNums && !reachableStarterNums.has(card.card_num)),
    }));

  const zeroSeenRarities = Object.keys(targetRarityCounts)
    .filter((rarity) => (seenRarityCounts[rarity] ?? 0) === 0)
    .sort((a, b) => sortRarityKeys([a, b]).indexOf(a) - sortRarityKeys([a, b]).indexOf(b));

  const unreachableStarterCount = missing.filter((item) => item.unreachableByStarterRefs).length;
  if (zeroSeenRarities.length > 0) warnings.push(`대상 레어도 전체 미등장: ${zeroSeenRarities.join(', ')}`);
  if (unreachableStarterCount > 0) warnings.push(`스타트덱 대표 카드 목록 밖 도감 대상 ${unreachableStarterCount}장`);
  if (targetCards.length > 0 && seen.size === 0) warnings.push('도감 대상이 있지만 1000회 샘플에서 힛카드 등록 0장');

  return {
    code: set.code,
    name: set.name_ko,
    type: set.type,
    trials,
    targetCount: targetCards.length,
    seenCount: seen.size,
    missingCount: missing.length,
    completionPct: targetCards.length > 0 ? (seen.size / targetCards.length) * 100 : 100,
    totalHitPulls,
    targetRarityCounts: sortedRarityRecord(targetRarityCounts),
    seenRarityCounts: sortedRarityRecord(seenRarityCounts),
    zeroSeenRarities,
    missing,
    warnings,
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

function renderRarityCounts(record: Record<string, number>): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return '<span class="muted">-</span>';
  return entries.map(([rarity, count]) => `<span class="pill">${escapeHtml(rarity)} ${count}</span>`).join('');
}

function renderMissing(report: SetReport): string {
  if (report.missing.length === 0) return '<p class="ok-text">미등장 도감 대상 없음</p>';

  const rows = report.missing.slice(0, 80).map((item) => `
    <tr>
      <td>${escapeHtml(item.rarity)}</td>
      <td>${escapeHtml(item.card.name_ko ?? '이름 확인 중')}</td>
      <td>${escapeHtml(item.card.card_num)}</td>
      <td>${item.unreachableByStarterRefs ? '<span class="bad-text">스타트덱 참조 없음</span>' : '<span class="muted">샘플 미등장</span>'}</td>
    </tr>
  `).join('');
  const more = report.missing.length > 80 ? `<p class="muted">외 ${report.missing.length - 80}장 더 있음</p>` : '';
  return `
    ${more}
    <table class="missing-table">
      <thead><tr><th>레어도</th><th>카드명</th><th>카드번호</th><th>상태</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderHtml(reports: SetReport[], trials: number, builtAt: string): string {
  const incomplete = reports.filter((report) => report.missingCount > 0);
  const warningReports = reports.filter((report) => report.warnings.length > 0);
  const totalTarget = reports.reduce((sum, report) => sum + report.targetCount, 0);
  const totalSeen = reports.reduce((sum, report) => sum + report.seenCount, 0);
  const totalMissing = reports.reduce((sum, report) => sum + report.missingCount, 0);

  const cards = reports.map((report) => `
    <section class="set-card ${report.missingCount === 0 ? 'pass' : 'fail'}">
      <div class="set-head">
        <div>
          <h2>${escapeHtml(report.name)}</h2>
          <p class="muted">${escapeHtml(report.code)} · ${escapeHtml(report.type)} · ${report.trials.toLocaleString()}회</p>
        </div>
        <strong>${report.seenCount}/${report.targetCount} <span>${report.completionPct.toFixed(1)}%</span></strong>
      </div>
      ${report.warnings.length > 0 ? `<div class="warnings">${report.warnings.map(escapeHtml).join('<br>')}</div>` : ''}
      <div class="counts"><span>대상</span>${renderRarityCounts(report.targetRarityCounts)}</div>
      <div class="counts"><span>등장</span>${renderRarityCounts(report.seenRarityCounts)}</div>
      <details ${report.missingCount > 0 ? 'open' : ''}>
        <summary>미등장 ${report.missingCount}장 보기</summary>
        ${renderMissing(report)}
      </details>
    </section>
  `).join('');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>힛카드 도감 1000회 커버리지</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #030712; color: #f8fafc; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 16px 56px; }
    h1 { margin: 0; font-size: clamp(24px, 4vw, 42px); letter-spacing: -0.03em; }
    h2 { margin: 0; font-size: 17px; }
    .lead { margin: 10px 0 0; color: #94a3b8; line-height: 1.6; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 22px 0; }
    .summary div { border: 1px solid rgba(125, 211, 252, .16); background: rgba(15, 23, 42, .8); border-radius: 14px; padding: 14px; }
    .summary span { display: block; color: #94a3b8; font-size: 12px; }
    .summary strong { display: block; margin-top: 6px; font-size: 22px; }
    .notice { border: 1px solid rgba(251, 191, 36, .22); background: rgba(120, 53, 15, .22); color: #fde68a; border-radius: 14px; padding: 13px 14px; line-height: 1.6; }
    .set-list { display: grid; gap: 14px; margin-top: 18px; }
    .set-card { border: 1px solid rgba(148, 163, 184, .16); background: rgba(15, 23, 42, .72); border-radius: 16px; padding: 15px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
    .set-card.pass { border-color: rgba(34, 197, 94, .28); }
    .set-card.fail { border-color: rgba(248, 113, 113, .34); }
    .set-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .set-head strong { flex: none; color: #e0f2fe; font-size: 20px; text-align: right; }
    .set-head strong span { display: block; color: #67e8f9; font-size: 12px; }
    .muted { color: #94a3b8; font-size: 12px; }
    .warnings { margin-top: 10px; border-radius: 12px; background: rgba(127, 29, 29, .36); color: #fecaca; padding: 10px 12px; font-size: 12px; line-height: 1.5; }
    .counts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; }
    .counts > span:first-child { width: 42px; color: #cbd5e1; font-size: 12px; font-weight: 800; }
    .pill { border-radius: 999px; background: rgba(14, 165, 233, .15); color: #bae6fd; border: 1px solid rgba(125, 211, 252, .16); padding: 4px 8px; font-size: 12px; font-weight: 800; }
    details { margin-top: 12px; }
    summary { cursor: pointer; color: #e2e8f0; font-size: 13px; font-weight: 800; }
    .ok-text { color: #86efac; font-size: 13px; }
    .bad-text { color: #fecaca; font-weight: 800; }
    .missing-table { width: 100%; border-collapse: collapse; margin-top: 10px; overflow: hidden; border-radius: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid rgba(148, 163, 184, .12); padding: 8px 7px; text-align: left; vertical-align: top; }
    th { color: #bae6fd; background: rgba(8, 47, 73, .35); }
    @media (max-width: 760px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .set-head { display: block; } .set-head strong { display: block; margin-top: 8px; text-align: left; } }
  </style>
</head>
<body>
  <main>
    <h1>힛카드 도감 1000회 커버리지</h1>
    <p class="lead">각 활성 세트를 ${trials.toLocaleString()}박스씩 시뮬레이션했습니다. 스타트덱은 제품 성격에 맞춰 ${trials.toLocaleString()}덱 추첨으로 검사했습니다. 생성 시각: ${escapeHtml(builtAt)}</p>
    <div class="summary">
      <div><span>검사 세트</span><strong>${reports.length.toLocaleString()}</strong></div>
      <div><span>도감 대상</span><strong>${totalTarget.toLocaleString()}</strong></div>
      <div><span>등장 대상</span><strong>${totalSeen.toLocaleString()}</strong></div>
      <div><span>미등장 대상</span><strong>${totalMissing.toLocaleString()}</strong></div>
    </div>
    <div class="notice">이 리포트의 “미등장”은 1000회 샘플에서 안 나왔다는 뜻입니다. 초저확률 카드라 운으로 빠질 수도 있고, 특정 레어도 전체가 0이면 봉입 모델/도감 대상 연결을 의심하면 됩니다. 카드 이미지는 대량 노출하지 않습니다.</div>
    <p class="lead">미완성 세트 ${incomplete.length.toLocaleString()}개 · 경고 세트 ${warningReports.length.toLocaleString()}개</p>
    <div class="set-list">${cards}</div>
  </main>
</body>
</html>`;
}

const trials = Math.max(1, Number(argValue('--trials', String(DEFAULT_TRIALS))) || DEFAULT_TRIALS);
const onlySet = argValue('--set');
const outDir = resolve(ROOT_DIR, 'frontend', 'public', 'debug');
const outHtml = resolve(outDir, 'hit-dex-coverage.html');
const outJson = resolve(outDir, 'hit-dex-coverage.json');
const index = readJson<SetIndex>(resolve(ROOT_DIR, 'data', 'sets-index.json'));
const setCodes = onlySet ? [onlySet] : index.active_sets;
const builtAt = new Date().toISOString();

mkdirSync(outDir, { recursive: true });

const reports: SetReport[] = [];
for (const [i, code] of setCodes.entries()) {
  const set = loadSet(code);
  console.log(`[${i + 1}/${setCodes.length}] ${set.code} ${set.name_ko} - ${trials}회 검사`);
  reports.push(auditSet(set, trials));
}

writeFileSync(outJson, JSON.stringify({ builtAt, trials, reports }, null, 2), 'utf8');
writeFileSync(outHtml, renderHtml(reports, trials, builtAt), 'utf8');

const totalMissing = reports.reduce((sum, report) => sum + report.missingCount, 0);
const warningCount = reports.filter((report) => report.warnings.length > 0).length;
console.log('\n=== 힛카드 도감 커버리지 요약 ===');
console.log(`세트 ${reports.length}개 / trials ${trials} / 미등장 ${totalMissing}장 / 경고 세트 ${warningCount}개`);
console.log(`HTML: ${outHtml}`);
console.log(`JSON: ${outJson}`);
