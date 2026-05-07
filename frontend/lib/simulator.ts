import seedrandom from 'seedrandom';
import type { Card, PackResult, BoxResult } from './types';

// 봉입률 출처:
//   - 일반 확장팩: 저지맨 (포켓몬카드 MVC) + 일본 1차 소스 (pokemon-infomation.com / altema / snkrdunk)
//   - 하이클래스 (메가드림 ex): pokemon-infomation.com 2,000박스 + altema + Pokelog 200박스
// 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않음 (오류 클레임 대비). 봉입 오류로 변동 가능.
// HR은 스칼렛&바이올렛부터 단종. MUR(메가울트라레어)은 메가시리즈에서 부활 — 우리 데이터에선 'UR' rarity로 분류.
// 갓팩/투힛은 수십 통 까도 안 나오는 게 정상.
export const PROBABILITY_META = {
  source: '저지맨 (포켓몬카드 MVC) + pokemon-infomation.com / altema.jp / snkrdunk',
  disclaimer:
    '봉입률은 커뮤니티 추정치입니다. 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않으며, 봉입 오류로 더 좋게/나쁘게 변동 가능합니다.',
  estimatedAt: '2026-05',
};

// 메가시리즈 일반 확장팩 (닌자스피너 / 니힐제로 / 메가브레이브 / 메가심포니아 / 인페르노X)
// 박스 30팩 × 5장. hit 슬롯 30개 중 다음 보장 — 위치는 랜덤 (D-126).
//   SR이상 힛 ×1 (SR or SAR or MUR — 일본 1차 소스 박스당 SR ~68% / SAR ~30% / MUR ~2%)
//   SR 아이템 ×1
//   AR ×3
// 나머지 25슬롯: R/RR 가중치
const EXPANSION_HIT_GUARANTEE_HI_WEIGHTS: Record<string, number> = {
  // pokemon-infomation.com 닌자스피너 ~28-34% SAR, ~2% MUR per box
  SR: 68,
  SAR: 30,
  UR: 2, // MUR — pokemoncard.co.kr 데이터에선 'UR' rarity로 분류됨
};

const EXPANSION_FILLER_WEIGHTS: Record<string, number> = {
  R: 75,
  RR: 25,
};

// 하이클래스팩 (메가드림 ex 등) — 1팩 10장 (9 일반 + 1 hit), 박스 10팩
// 출처: pokemon-infomation.com (2,000박스 분석) + altema.jp + snkrdunk + Pokelog 200박스
//   - 박스당 확정: MA ×1, 트레이너 SR ×1 (별도 슬롯), AR ×3, RR ×4 = 9슬롯 보장
//   - 트레이너 SR 풀: Item SR 6종 + Support SR 3종 (메가드림 ex에 포켓몬 SR 없음)
//   - 10번째 변형 슬롯: 50% RR(기본) / 40% SAR (박스당 SAR ~40%) / 10% 추가 SR (~10%)
//   - 갓팩 (~0.75%, 약 133박스당 1장 — 출처마다 30~250박스 편차):
//     박스 hit 10장 전부 교체 → AR×1 + MA(RR풀)×5 + SAR×4
const HI_CLASS_VARIABLE_WEIGHTS: Record<string, number> = {
  RR: 50,
  SAR: 40,
  SR: 10,
};
// MA 슬롯에서 MUR 등장 가능 — 출처: 저지맨 "MA 힛카드 1장(여기서 MUR 등장)"
// 일본 데이터 박스당 MUR ~1-2%, 우리 데이터엔 'UR' rarity로 분류
const HI_CLASS_MA_SLOT_WEIGHTS: Record<string, number> = {
  RR: 98,
  UR: 2,
};
const HI_CLASS_GOD_PACK_RATE = 0.0075;

interface RNG {
  (): number;
}

function makePick(rng: RNG) {
  return <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
}

function makeWeightedPick(rng: RNG) {
  return (weights: Record<string, number>): string => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (const [key, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return key;
    }
    return Object.keys(weights).at(-1)!;
  };
}

// 빈 카드 풀(데이터 미수집)을 가중치에서 제외 — 자동 재정규화
function filterAvailableWeights(
  weights: Record<string, number>,
  byRarity: Record<string, Card[]>,
): Record<string, number> {
  const filtered: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    if ((byRarity[k]?.length ?? 0) > 0) filtered[k] = v;
  }
  return Object.keys(filtered).length > 0 ? filtered : weights;
}

// Fisher-Yates (D-131)
function shuffle<T>(arr: T[], rng: RNG): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function groupByRarity(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};
  for (const card of cards) {
    const r = card.rarity ?? '__null__';
    (groups[r] ??= []).push(card);
  }
  return groups;
}

interface BuildContext {
  byRarity: Record<string, Card[]>;
  pick: <T>(arr: T[]) => T;
  weightedPick: (w: Record<string, number>) => string;
}

// 일반 확장팩 1팩: C×3 + U×1 + hit×1 (5장)
function buildExpansionPack(ctx: BuildContext, hitRarity: string): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const cPool = byRarity['C'] ?? [];
  const uPool = byRarity['U'] ?? [];
  for (let i = 0; i < 3; i++) {
    if (cPool.length) cards.push(pick(cPool));
  }
  if (uPool.length) cards.push(pick(uPool));
  const hitPool = byRarity[hitRarity] ?? byRarity['R'] ?? [];
  if (hitPool.length) cards.push(pick(hitPool));
  return { cards };
}

// 하이클래스 1팩: 9 일반(rarity null) + 1 hit (10장) — 메가드림 ex 가정
function buildHiClassPack(ctx: BuildContext, hitRarity: string, packSize: number): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const basePool = byRarity['__null__'] ?? byRarity['R'] ?? [];
  const baseCount = Math.max(0, packSize - 1);
  for (let i = 0; i < baseCount; i++) {
    if (basePool.length) cards.push(pick(basePool));
  }
  const hitPool = byRarity[hitRarity] ?? byRarity['RR'] ?? basePool;
  if (hitPool.length) cards.push(pick(hitPool));
  return { cards };
}

function simulateExpansionBox(allCards: Card[], boxSize: number, ctx: BuildContext, rng: RNG): PackResult[] {
  // 박스 hit 슬롯 보장 배치
  const slots: string[] = [];
  // SR이상 힛 ×1 — 빈 풀(MUR 미수집) 자동 폴백
  const hiWeights = filterAvailableWeights(EXPANSION_HIT_GUARANTEE_HI_WEIGHTS, ctx.byRarity);
  slots.push(ctx.weightedPick(hiWeights));
  slots.push('SR'); // SR 아이템 ×1
  slots.push('AR', 'AR', 'AR'); // AR ×3
  while (slots.length < boxSize) {
    slots.push(ctx.weightedPick(EXPANSION_FILLER_WEIGHTS));
  }
  const placed = shuffle(slots, rng);
  return placed.map((hit) => buildExpansionPack(ctx, hit));
}

function simulateHiClassBox(
  boxSize: number,
  packSize: number,
  ctx: BuildContext,
  rng: RNG,
): PackResult[] {
  const slots: string[] = [];
  const isGodPack = rng() < HI_CLASS_GOD_PACK_RATE;

  if (isGodPack) {
    // 갓팩 박스: AR×1 + MA(RR 풀)×5 + SAR×4 — 박스 전체 hit 교체
    slots.push('AR');
    for (let i = 0; i < 5; i++) slots.push('RR');
    for (let i = 0; i < 4; i++) slots.push('SAR');
  } else {
    // 정상 박스: 4 RR(일반) + 1 MA(RR or MUR ~2%) + 3 AR + 1 SR + 1 variable
    for (let i = 0; i < 4; i++) slots.push('RR');
    slots.push(ctx.weightedPick(filterAvailableWeights(HI_CLASS_MA_SLOT_WEIGHTS, ctx.byRarity)));
    slots.push('AR', 'AR', 'AR');
    slots.push('SR');
    slots.push(ctx.weightedPick(filterAvailableWeights(HI_CLASS_VARIABLE_WEIGHTS, ctx.byRarity)));
  }

  // boxSize가 10이 아닐 경우 fallback (현재 모든 hi-class는 10팩이지만)
  while (slots.length < boxSize) slots.push('RR');
  if (slots.length > boxSize) slots.length = boxSize;

  const placed = shuffle(slots, rng);
  return placed.map((hit) => buildHiClassPack(ctx, hit, packSize));
}

// 자판기 1팩 모드 (D-128) — 박스 보장룰/갓팩 무시, 가중치만 적용.
// 가중치는 박스 평균 분포 기반 추정.
//   일반팩 박스(30팩) 평균 hit: R 18.75 / RR 6.25 / AR 3 / SR ~1.4 / SAR ~0.3 / MUR ~0.02
//   하이클래스 박스(10팩) 평균 hit: RR ~5 / AR 3 / SR ~1.1 / SAR ~0.4 / MUR ~0.02
const EXPANSION_PACK_HIT_WEIGHTS: Record<string, number> = {
  R: 625,
  RR: 208,
  AR: 100,
  SR: 47,
  SAR: 10,
  UR: 1,
};
const HI_CLASS_PACK_HIT_WEIGHTS: Record<string, number> = {
  RR: 500,
  AR: 300,
  SR: 110,
  SAR: 40,
  UR: 2,
};

export function simulatePack(
  allCards: Card[],
  type: string,
  packSize: number,
  seedInput?: string,
): { pack: PackResult; seed: string } {
  const seed = seedInput ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rng = seedrandom(seed);
  const pick = makePick(rng);
  const weightedPick = makeWeightedPick(rng);
  const byRarity = groupByRarity(allCards);
  const ctx: BuildContext = { byRarity, pick, weightedPick };

  const hitWeights =
    type === 'hi-class' ? HI_CLASS_PACK_HIT_WEIGHTS : EXPANSION_PACK_HIT_WEIGHTS;

  const filtered = filterAvailableWeights(hitWeights, byRarity);
  const hitRarity = ctx.weightedPick(filtered);

  const pack =
    type === 'hi-class'
      ? buildHiClassPack(ctx, hitRarity, packSize)
      : buildExpansionPack(ctx, hitRarity);

  return { pack, seed };
}

export function simulateBox(
  allCards: Card[],
  boxSize: number,
  type: string,
  packSize: number,
  seedInput?: string,
): BoxResult {
  const seed = seedInput ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rng = seedrandom(seed);
  const pick = makePick(rng);
  const weightedPick = makeWeightedPick(rng);
  const byRarity = groupByRarity(allCards);
  const ctx: BuildContext = { byRarity, pick, weightedPick };

  const packs =
    type === 'hi-class'
      ? simulateHiClassBox(boxSize, packSize, ctx, rng)
      : simulateExpansionBox(allCards, boxSize, ctx, rng);

  const summary: Record<string, number> = {};
  for (const pack of packs) {
    for (const card of pack.cards) {
      const r = card.rarity ?? '?';
      summary[r] = (summary[r] ?? 0) + 1;
    }
  }

  return { packs, summary, seed };
}
