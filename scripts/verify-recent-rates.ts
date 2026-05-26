import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';
const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SETS = [
  's10b-pokemon-go',
  's9a-battle-region',
  's9-star-birth',
  's8b-vmax-climax',
  's8-fusion-arts',
];

const HIT_RARITIES = ['CHR', 'CSR', 'AR', 'K', 'SR', 'SSR', 'HR', 'SAR', 'MA', 'UR', 'GRA', 'BWR', 'ACE'];

function loadSet(code: string): SetMeta {
  const path = resolve(ROOT_DIR, 'frontend', 'public', 'sets', `${code}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as SetMeta;
}

function fmtPct(p: number): string {
  return (p * 100).toFixed(2) + '%';
}

function simulateBoxes(set: SetMeta, n: number) {
  const totals: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const res = simulateBox(set.cards, set.box_size!, set.type, set.pack_size!, undefined, set.code);
    for (const [r, c] of Object.entries(res.summary)) totals[r] = (totals[r] ?? 0) + c;
  }
  const perBox: Record<string, number> = {};
  for (const [r, c] of Object.entries(totals)) perBox[r] = c / n;
  return perBox;
}

function simulatePacks(set: SetMeta, n: number) {
  const totals: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const { pack } = simulatePack(set.cards, set.type, set.pack_size!, undefined, set.code);
    for (const card of pack.cards) {
      if (card.rarity) totals[card.rarity] = (totals[card.rarity] ?? 0) + 1;
    }
  }
  const perPack: Record<string, number> = {};
  for (const [r, c] of Object.entries(totals)) perPack[r] = c / n;
  return perPack;
}

const BOX_TRIALS = 5000;
const PACK_TRIALS = 50000;

for (const code of SETS) {
  const set = loadSet(code);
  const rarities = new Set<string>();
  for (const c of set.cards) if (c.rarity) rarities.add(c.rarity);
  console.log(`\n==================== ${code} (${set.name_ko ?? ''}) ====================`);
  console.log(`type=${set.type} | box_size=${set.box_size} | pack_size=${set.pack_size} | rarities in data: ${[...rarities].join(', ')}`);

  console.log('\n[박스깡] per-box expected hits (over', BOX_TRIALS, 'boxes):');
  const boxRates = simulateBoxes(set, BOX_TRIALS);
  const sortedBoxKeys = Object.keys(boxRates).filter((r) => HIT_RARITIES.includes(r))
    .sort((a, b) => HIT_RARITIES.indexOf(a) - HIT_RARITIES.indexOf(b));
  for (const r of sortedBoxKeys) {
    const exp = boxRates[r];
    const probAtLeastOne = 1 - Math.exp(-exp);
    console.log(`  ${r.padEnd(5)} ${exp.toFixed(4).padStart(8)} / box   (P≥1: ${fmtPct(probAtLeastOne)})`);
  }

  console.log('\n[자판기깡] per-pack rate (over', PACK_TRIALS, 'packs):');
  const packRates = simulatePacks(set, PACK_TRIALS);
  const sortedPackKeys = Object.keys(packRates).filter((r) => HIT_RARITIES.includes(r))
    .sort((a, b) => HIT_RARITIES.indexOf(a) - HIT_RARITIES.indexOf(b));
  for (const r of sortedPackKeys) {
    const exp = packRates[r];
    console.log(`  ${r.padEnd(5)} ${fmtPct(exp).padStart(8)} per pack  (1 in ${(1/exp).toFixed(1)} packs)`);
  }
}
