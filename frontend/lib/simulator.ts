import seedrandom from 'seedrandom';
import type { Card, PackResult, BoxResult } from './types';

// 봉입률 출처: 저지맨 (포켓몬카드 MVC) 안내 + 커뮤니티 합의
// 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않으며, 봉입 오류로 더 좋게/나쁘게 변동 가능.
// MUR/HR는 스칼렛&바이올렛부터 단종 — 본 시뮬에선 미사용.
export const PROBABILITY_META = {
  source: '저지맨 (포켓몬카드 MVC) 안내 + 커뮤니티 합의',
  disclaimer:
    '봉입률은 커뮤니티 추정치입니다. 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않습니다.',
  estimatedAt: '2026-05',
};

// 메가시리즈 일반 확장팩 박스 보장 (닌자스피너 / 니힐제로 / 메가브레이브 / 메가심포니아 / 인페르노X)
// 박스 30팩 중 hit 슬롯에 다음을 보장 — 위치는 랜덤 (D-126).
//   SR이상 힛 ×1 (SR or SAR)
//   SR 아이템 ×1 (현재 풀에선 SR로 통일)
//   AR ×3
// 나머지 25슬롯: R/RR 가중치
const EXPANSION_HIT_GUARANTEE_HI_WEIGHTS: Record<string, number> = {
  // SR이상 힛 슬롯의 SR vs SAR 비율 (랜덤)
  SR: 7,
  SAR: 3,
};

const EXPANSION_FILLER_WEIGHTS: Record<string, number> = {
  R: 75,
  RR: 25,
};

// 하이클래스팩 (메가드림 ex 등) — 1팩 10장 (9 일반 + 1 hit), 박스 10팩
//   ⓐ 박스 기본 hit: SAR(MA) ×1 + SR 아이템 ×1 + AR ×3 (5슬롯 보장)
//   ⓑ 나머지 5슬롯 filler — 대체로 RR
//   ⓒ 투힛 봉투: 박스에 따라 랜덤으로 한 팩에 추가 hit 1장 (SR or SAR)
//   ⓓ 갓팩: 투힛 자리 한정, 매우 희박 — 추가 hit를 SAR로 강제
const HI_CLASS_FILLER_WEIGHTS: Record<string, number> = {
  RR: 90,
  AR: 5,
  SR: 4,
  SAR: 1,
};
const HI_CLASS_TWO_HIT_RATE = 0.2;
const HI_CLASS_TWO_HIT_WEIGHTS: Record<string, number> = {
  SR: 6,
  SAR: 4,
};
const GOD_PACK_RATE_WITHIN_TWO_HIT = 0.02;

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
  slots.push(ctx.weightedPick(EXPANSION_HIT_GUARANTEE_HI_WEIGHTS)); // SR이상 힛 ×1
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
  // 박스 hit 슬롯 (총 boxSize개 = 팩당 1장씩)
  const slots: string[] = ['SAR', 'SR', 'AR', 'AR', 'AR'];
  while (slots.length < boxSize) {
    slots.push(ctx.weightedPick(HI_CLASS_FILLER_WEIGHTS));
  }
  const placed = shuffle(slots, rng);
  const packs = placed.map((hit) => buildHiClassPack(ctx, hit, packSize));

  // 투힛: 한 팩에 hit 1장 추가 (SR or SAR), 일반카드 1장과 교체
  const hasTwoHit = rng() < HI_CLASS_TWO_HIT_RATE;
  if (hasTwoHit) {
    let twoHitRarity = ctx.weightedPick(HI_CLASS_TWO_HIT_WEIGHTS);
    // 갓팩: 투힛 자리에서 매우 희박하게 SAR 강제
    if (rng() < GOD_PACK_RATE_WITHIN_TWO_HIT) twoHitRarity = 'SAR';
    const targetIdx = Math.floor(rng() * boxSize);
    const pool = ctx.byRarity[twoHitRarity] ?? [];
    if (pool.length && packs[targetIdx].cards.length > 0) {
      // 첫번째 일반카드 자리를 추가 hit로 교체
      packs[targetIdx].cards[0] = ctx.pick(pool);
    }
  }

  return packs;
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
