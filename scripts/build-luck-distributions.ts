#!/usr/bin/env tsx
/**
 * 세트별 "전형적인(중앙값) 박스/팩 가치"를 시뮬레이션으로 미리 계산해 set JSON에 박는다.
 * 가치 기반 운은 observed(실제 뽑은 가치) / expected(전형적 가치)로 등급을 매기는데,
 * expected를 평균(mean)으로 잡으면 고가 카드가 평균을 끌어올려 대부분의 박스가 '조무래기'로
 * 떨어진다. 그래서 expected를 중앙값(median) + 분위수로 잡아 전형적 박스가 중간 등급이 되게 한다.
 *
 * 사용: pnpm --dir scripts build:luck-dist            (전체)
 *       pnpm --dir scripts build:luck-dist -- --set sv4k-ancient-roar
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import openingHistoryDefault from '../frontend/lib/openingHistory.ts';
import starterDefault from '../frontend/lib/simulation/starter.ts';
import valueLuckDefault from '../frontend/lib/valueLuck.ts';
import type { StartDeckMeta } from '../frontend/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data', 'sets');
const PUBLIC_DIR = join(ROOT, 'frontend', 'public', 'sets');
const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { getOpeningHitCards } = openingHistoryDefault as unknown as typeof import('../frontend/lib/openingHistory.ts');
const { simulateStartDeck } = starterDefault as unknown as typeof import('../frontend/lib/simulation/starter.ts');
const { getObservedReferenceValueKrw } = valueLuckDefault as unknown as typeof import('../frontend/lib/valueLuck.ts');

const argv = process.argv.slice(2);
const onlySet = argv.includes('--set') ? argv[argv.indexOf('--set') + 1] : undefined;
const BOX_ITER = 20000;
const PACK_ITER = 40000;
// 저장할 분위수(0~1). 단일 박스 등급 분포를 분위수로 매핑하는 데 사용.
const QUANTILES = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99, 1];

function quantilesOf(sorted: number[]): number[] {
  return QUANTILES.map((q) => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    return Math.round(sorted[idx]);
  });
}

function openingValue(
  cards: { rarity?: string | null; price_ref_krw?: number | null; price_confidence?: string | null }[],
  code: string,
  type: string,
): number {
  // 앱과 동일: hit(가격 있는) 카드들의 가치 합.
  const hit = getOpeningHitCards(cards as never, { code, type } as never);
  return getObservedReferenceValueKrw(hit as never, { code } as never);
}

function build(setCode: string): boolean {
  const path = join(DATA_DIR, `${setCode}.json`);
  let set: Record<string, unknown> & {
    type?: string;
    box_size?: number;
    pack_size?: number;
    cards?: unknown[];
    start_deck?: StartDeckMeta;
  };
  try {
    set = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
  const cards = (set.cards ?? []) as never[];
  if (cards.length === 0) return false;

  const boxSize = (set.box_size as number) || 30;
  const packSize = (set.pack_size as number) || 5;
  const type = (set.type as string) || 'expansion';

  const boxVals: number[] = [];
  for (let i = 0; i < BOX_ITER; i++) {
    if (type === 'starter') {
      if (!set.start_deck) return false;
      const deck = simulateStartDeck(cards, set.start_deck, `lb${i}`);
      boxVals.push(openingValue(deck.cards as never, setCode, type));
    } else {
      const box = simulateBox(cards, boxSize, type, packSize, `lb${i}`, setCode);
      boxVals.push(openingValue(box.packs.flatMap((p) => p.cards) as never, setCode, type));
    }
  }
  const packVals: number[] = [];
  for (let i = 0; i < PACK_ITER; i++) {
    if (type === 'starter') {
      if (!set.start_deck) return false;
      const deck = simulateStartDeck(cards, set.start_deck, `lp${i}`);
      packVals.push(openingValue(deck.cards as never, setCode, type));
    } else {
      const { pack } = simulatePack(cards, type, packSize, `lp${i}`, setCode);
      packVals.push(openingValue(pack.cards as never, setCode, type));
    }
  }
  boxVals.sort((a, b) => a - b);
  packVals.sort((a, b) => a - b);

  const median = (s: number[]) => s[Math.floor(s.length / 2)];
  set.luck_value_ref = {
    box_median_krw: Math.round(median(boxVals)),
    pack_median_krw: Math.round(median(packVals)),
    box_quantiles_krw: quantilesOf(boxVals),
    pack_quantiles_krw: quantilesOf(packVals),
    quantile_points: QUANTILES,
    _iterations: { box: BOX_ITER, pack: PACK_ITER },
    _built_at: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()),
  };

  const out = JSON.stringify(set, null, 2) + '\n';
  writeFileSync(path, out, 'utf8');
  writeFileSync(join(PUBLIC_DIR, `${setCode}.json`), out, 'utf8');
  console.log(
    `${setCode}: box median ${set.luck_value_ref.box_median_krw.toLocaleString()}원, pack median ${set.luck_value_ref.pack_median_krw.toLocaleString()}원`,
  );
  return true;
}

function main(): void {
  const index = JSON.parse(readFileSync(join(ROOT, 'data', 'sets-index.json'), 'utf8')) as { active_sets?: string[] };
  const codes = onlySet ? [onlySet] : index.active_sets ?? [];
  let n = 0;
  for (const code of codes) if (build(code)) n++;
  console.log(`\nbuilt luck distributions for ${n} set(s).`);
}

main();
