import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const INDEX = JSON.parse(readFileSync(resolve(ROOT_DIR, 'data', 'sets-index.json'), 'utf8')) as { active_sets: string[] };
const HIT_RARITIES = ['CHR', 'CSR', 'AR', 'K', 'ACE', '25TH', 'S8AP', 'SR', 'SSR', 'HR', 'SAR', 'MA', 'UR', 'GRA', 'BWR'];
const ANNIVERSARY_25_SET_CODE = 's8a-25th-anniversary';
const SWSH_CHARACTER_SUBSETS = new Set([
  's11a-incandescent-arcana',
  's10a-dark-phantasma',
  's9a-battle-region',
]);

type Report = {
  code: string;
  type: string;
  box_size: number;
  pack_size: number;
  totalCards: number;
  nullRarity: number;
  rarityCounts: Record<string, number>;
  perBoxHits: Record<string, number>;
  emptyHighPools: string[];
  totalExpectedHitsPerBox: number;
  warnings: string[];
};

function loadSet(code: string): SetMeta {
  const path = resolve(ROOT_DIR, 'frontend', 'public', 'sets', `${code}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as SetMeta;
}

function countRarities(set: SetMeta): { counts: Record<string, number>; nullCount: number } {
  const counts: Record<string, number> = {};
  let nullCount = 0;
  for (const c of set.cards) {
    if (!c.rarity) {
      nullCount++;
    } else {
      counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
    }
  }
  return { counts, nullCount };
}

function simulateBoxes(set: SetMeta, n: number): Record<string, number> {
  const totals: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const res = simulateBox(set.cards, set.box_size!, set.type, set.pack_size!, undefined, set.code);
    for (const [r, c] of Object.entries(res.summary)) totals[r] = (totals[r] ?? 0) + c;
  }
  const perBox: Record<string, number> = {};
  for (const [r, c] of Object.entries(totals)) perBox[r] = c / n;
  return perBox;
}

function getHitRarities(code: string): string[] {
  return code === ANNIVERSARY_25_SET_CODE ? ['RR', 'RRR', ...HIT_RARITIES] : HIT_RARITIES;
}

const BOX_TRIALS = 1000;
const reports: Report[] = [];

for (const code of INDEX.active_sets) {
  try {
    const set = loadSet(code);
    const { counts, nullCount } = countRarities(set);
    const perBox = simulateBoxes(set, BOX_TRIALS);
    const warnings: string[] = [];

    if (nullCount > 0 && code !== ANNIVERSARY_25_SET_CODE) warnings.push(`${nullCount} cards with null rarity`);
    if (set.cards.length < 30) warnings.push('very few cards in data');

    // High rarity expected by typical hi-class but missing in data
    if (set.type === 'hi-class') {
      if (!counts.CHR && !counts.SAR) warnings.push('hi-class missing both CHR and SAR');
      if (!counts.SR) warnings.push('hi-class missing SR');
    }

    if (SWSH_CHARACTER_SUBSETS.has(code)) {
      if (!counts.CHR) warnings.push('SwSh character subset missing CHR');
    }
    if (set.type === 'expansion' && code.startsWith('sv')) {
      if (!counts.SAR) warnings.push('SV expansion missing SAR');
    }

    // Mega series
    if (code.startsWith('m') && !code.startsWith('m4-')) {
      if (!counts.UR && !counts.MUR) warnings.push('mega set missing UR/MUR');
    }

    const hitRarities = getHitRarities(code);
    const totalHits = hitRarities.reduce((sum, r) => sum + (perBox[r] ?? 0), 0);

    reports.push({
      code,
      type: set.type,
      box_size: set.box_size ?? 0,
      pack_size: set.pack_size ?? 0,
      totalCards: set.cards.length,
      nullRarity: nullCount,
      rarityCounts: counts,
      perBoxHits: perBox,
      emptyHighPools: hitRarities.filter((r) => !counts[r]),
      totalExpectedHitsPerBox: totalHits,
      warnings,
    });
  } catch (e) {
    console.error(`ERROR ${code}:`, (e as Error).message);
  }
}

console.log('\n=== Per-set summary ===');
console.log('code'.padEnd(28) + 'type'.padEnd(11) + 'cards'.padEnd(7) + 'null'.padEnd(6) + 'hits/box'.padEnd(10) + 'warnings');
console.log('-'.repeat(110));
for (const r of reports) {
  const w = r.warnings.length ? r.warnings.join('; ') : '';
  console.log(
    r.code.padEnd(28) +
    r.type.padEnd(11) +
    String(r.totalCards).padEnd(7) +
    (r.nullRarity ? String(r.nullRarity).padEnd(6) : '-'.padEnd(6)) +
    r.totalExpectedHitsPerBox.toFixed(2).padEnd(10) +
    w,
  );
}

console.log('\n=== Sets with warnings ===');
for (const r of reports.filter((x) => x.warnings.length > 0)) {
  console.log(`\n--- ${r.code} (${r.type}, box ${r.box_size}p × pack ${r.pack_size}c) ---`);
  console.log(`  Rarity counts:`, r.rarityCounts);
  console.log(`  Per-box hits (only HIT rarities):`);
  for (const k of getHitRarities(r.code)) {
    if (r.perBoxHits[k]) console.log(`    ${k.padEnd(5)} ${r.perBoxHits[k].toFixed(3)}`);
  }
  console.log(`  WARNINGS: ${r.warnings.join(' | ')}`);
}
