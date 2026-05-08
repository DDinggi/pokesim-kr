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

// 일반 확장팩 박스 hit 슬롯 보장 — 위치는 랜덤 (D-126).
//   몬스터 SR이상 ×1 (SR포켓몬 / SAR포켓몬 / UR — 세트별 다름)
//   트레이너 SR이상 ×1 (SR트레이너 95% / SAR트레이너 5% 고정)
//   AR ×3
// 나머지 슬롯(boxSize - 5): R/RR 가중치
//
// 세트별 몬스터 슬롯 가중치 (출처: pokemon-infomation.com / Samurai Sword Tokyo, 2026-05)
//   닌자스피너: SAR 33% — samuraiswordtokyo.com
//   니힐제로:   SAR 16% — samuraiswordtokyo.com ← 유독 낮음
//   인페르노X:  SAR 30% — samuraiswordtokyo.com
//   메가브레이브: SAR 28% — pokemon-infomation.com (~1000박스)
//   메가심포니아: SAR 29% — pokemon-infomation.com / samuraiswordtokyo.com
//   SV 확장팩 (sv1a~sv10): 커뮤니티 추정 기본값 적용 (SR:68 / SAR:30 / UR:2)
//   sv11A/B (화이트플레어·블랙볼트): BWR(블랙화이트레어) 추가 — UR보다 희귀, ~2% 추정
const EXPANSION_MONSTER_WEIGHTS: Record<string, Record<string, number>> = {
  'm4-ninja-spinner':  { SR: 65, SAR: 33, UR: 2 },
  'm-nihil-zero':      { SR: 82, SAR: 16, UR: 2 },
  'm-inferno-x':       { SR: 68, SAR: 30, UR: 2 },
  'm-mega-brave':      { SR: 70, SAR: 28, UR: 2 },
  'm-mega-symphonia':  { SR: 70, SAR: 29, UR: 1 },
  'sv11a-white-flare': { SR: 67, SAR: 28, UR: 3, BWR: 2 },
  'sv11b-black-bolt':  { SR: 67, SAR: 28, UR: 3, BWR: 2 },
};
const EXPANSION_MONSTER_WEIGHTS_DEFAULT: Record<string, number> = { SR: 68, SAR: 30, UR: 2 };

// 트레이너 슬롯: SR 트레이너 보장, SAR 트레이너 5% 소확률
// SAR×2 확률 = 몬스터SAR% × 5% ≈ 0.8~1.7% (세트별) — "극히 드물지만 가능"
const TRAINER_SLOT_WEIGHTS: Record<string, number> = { SR: 95, SAR: 5 };

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

// 일반 확장팩 1팩: C×(packSize-2) + U×1 + hit×1
// hitPool: 이미 결정된 hit 카드 풀 (caller가 포켓몬/트레이너 분리 책임)
function buildExpansionPack(ctx: BuildContext, hitPool: Card[], packSize = 5): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const cPool = byRarity['C'] ?? [];
  const uPool = byRarity['U'] ?? [];
  for (let i = 0; i < packSize - 2; i++) {
    if (cPool.length) cards.push(pick(cPool));
  }
  if (uPool.length) cards.push(pick(uPool));
  const effective = hitPool.length > 0 ? hitPool : (byRarity['R'] ?? []);
  if (effective.length) cards.push(pick(effective));
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

function simulateExpansionBox(
  _allCards: Card[],
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
  packSize = 5,
): PackResult[] {
  const { byRarity } = ctx;

  const isPokemon = (c: Card) => c.card_type === '포켓몬';
  const isTrainer = (c: Card) => c.card_type === '트레이너' || c.card_type === '에너지';

  const srAll = byRarity['SR'] ?? [];
  const sarAll = byRarity['SAR'] ?? [];
  const urAll = byRarity['UR'] ?? [];
  const bwrAll = byRarity['BWR'] ?? [];

  const srPokemon = srAll.filter(isPokemon);
  const srTrainer = srAll.filter(isTrainer);
  const sarPokemon = sarAll.filter(isPokemon);
  const sarTrainer = sarAll.filter(isTrainer);
  const urPokemon = urAll.filter(isPokemon);
  const bwrPokemon = bwrAll.filter(isPokemon);

  // ① 몬스터 SR이상 슬롯 — 세트별 SAR/BWR 확률 적용
  const rawMonsterW = (setCode ? EXPANSION_MONSTER_WEIGHTS[setCode] : null) ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;
  const monsterWeights: Record<string, number> = {};
  if (srPokemon.length && rawMonsterW['SR']) monsterWeights['SR'] = rawMonsterW['SR'];
  if (sarPokemon.length && rawMonsterW['SAR']) monsterWeights['SAR'] = rawMonsterW['SAR'];
  if (urPokemon.length && rawMonsterW['UR']) monsterWeights['UR'] = rawMonsterW['UR'];
  if (bwrPokemon.length && rawMonsterW['BWR']) monsterWeights['BWR'] = rawMonsterW['BWR'];

  let monsterPool: Card[];
  if (Object.keys(monsterWeights).length > 0) {
    const r = ctx.weightedPick(monsterWeights);
    if (r === 'BWR') monsterPool = bwrPokemon;
    else if (r === 'SAR') monsterPool = sarPokemon;
    else if (r === 'UR') monsterPool = urPokemon;
    else monsterPool = srPokemon;
  } else {
    // card_type 미분류 폴백: 전체 SR 풀에서 rarity 기반 추첨
    const fw = filterAvailableWeights(rawMonsterW, byRarity);
    const r = ctx.weightedPick(fw);
    monsterPool = byRarity[r] ?? srAll;
  }

  // ② 트레이너 SR이상 슬롯 — SR 95% / SAR 5% 고정 (SAR×2 확률 ~0.8~1.7%)
  const trainerWeights: Record<string, number> = {};
  if (srTrainer.length) trainerWeights['SR'] = TRAINER_SLOT_WEIGHTS['SR'];
  if (sarTrainer.length) trainerWeights['SAR'] = TRAINER_SLOT_WEIGHTS['SAR'];
  let trainerPool: Card[];
  if (Object.keys(trainerWeights).length > 0) {
    const r = ctx.weightedPick(trainerWeights);
    trainerPool = r === 'SAR' ? sarTrainer : srTrainer;
  } else {
    trainerPool = srAll;
  }

  // 슬롯 조립
  const slots: Card[][] = [];
  slots.push(monsterPool);
  slots.push(trainerPool);
  const arPool = byRarity['AR'] ?? [];
  slots.push(arPool, arPool, arPool);
  while (slots.length < boxSize) {
    const r = ctx.weightedPick(EXPANSION_FILLER_WEIGHTS);
    slots.push(byRarity[r] ?? byRarity['R'] ?? []);
  }

  const placed = shuffle(slots, rng);
  return placed.map((pool) => buildExpansionPack(ctx, pool, packSize));
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
      : buildExpansionPack(ctx, byRarity[hitRarity] ?? byRarity['R'] ?? [], packSize);

  return { pack, seed };
}

export function simulateBox(
  allCards: Card[],
  boxSize: number,
  type: string,
  packSize: number,
  seedInput?: string,
  setCode?: string,
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
      : simulateExpansionBox(allCards, boxSize, ctx, rng, setCode, packSize);

  const summary: Record<string, number> = {};
  for (const pack of packs) {
    for (const card of pack.cards) {
      const r = card.rarity ?? '?';
      summary[r] = (summary[r] ?? 0) + 1;
    }
  }

  return { packs, summary, seed };
}
