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
//   SV 일반: SR/SAR/UR ×1 + AR ×3
//   SV11 블랙/화이트: SR/SAR/BWR ×1 + AR ×4
//   MEGA 확장팩: 트레이너 SR ×1 + SR/SAR/MUR ×1 + AR ×3
// 나머지 슬롯: R/RR 가중치
//
// MEGA 세트별 SR/SAR/MUR 슬롯 가중치 (출처: pokemon-infomation.com / Samurai Sword Tokyo, 2026-05)
//   닌자스피너: SAR 28% — pokemon-infomation.com (~1000박스)
//   니힐제로:   SAR 28% — pokemon-infomation.com (~1000박스)
//   인페르노X:  SAR 28% — pokemon-infomation.com (~1000박스)
//   메가브레이브: SAR 28% — pokemon-infomation.com (~1000박스)
//   메가심포니아: SAR 28% — pokemon-infomation.com (~1000박스)
const EXPANSION_MONSTER_WEIGHTS: Record<string, Record<string, number>> = {
  'm4-ninja-spinner':  { SR: 70, SAR: 28, UR: 2 },
  'm-nihil-zero':      { SR: 70, SAR: 28, UR: 2 },
  'm-inferno-x':       { SR: 70, SAR: 28, UR: 2 },
  'm-mega-brave':      { SR: 70, SAR: 28, UR: 2 },
  'm-mega-symphonia':  { SR: 70, SAR: 28, UR: 2 },
};
const EXPANSION_MONSTER_WEIGHTS_DEFAULT: Record<string, number> = { SR: 68, SAR: 30, UR: 2 };
const STANDARD_SV_HIGH_WEIGHTS: Record<string, number> = { SR: 70, SAR: 20, UR: 10 };
const SV11_HIGH_WEIGHTS: Record<string, number> = { SR: 70, SAR: 25, BWR: 5 };

const STANDARD_EXTRA_SR_RATE = 0.1;
const EXTRA_SR_RATE_BY_SET: Record<string, number> = {
  'sv1a-triplet': 0.05,
};
const MEGA_EXTRA_SR_RATE = 0.1;
const SV11_EXTRA_SR_RATE = 0.1;

const MEGA_EXPANSION_FILLER_WEIGHTS: Record<string, number> = { R: 82, RR: 18 };
const STANDARD_30_PACK_FILLER_WEIGHTS: Record<string, number> = { R: 85, RR: 15 };
const STANDARD_20_PACK_FILLER_WEIGHTS: Record<string, number> = { R: 73, RR: 27 };

// 하이클래스팩은 한 팩 안에 여러 hit가 들어갈 수 있다.
// Terastal Festa ex: Pokemon SAR x1 is guaranteed; supporter SR/SAR/UR is an extra slot.
const TERASTAL_EXTRA_SLOT_RATE = 0.4;
const TERASTAL_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  SR: 20,
  SAR: 10,
  UR: 6,
};
// MEGA Dream ex: guaranteed MA + trainer SR + AR x3, with an optional SR/SAR/MUR slot.
const MEGA_DREAM_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 48,
  SR: 10,
  SAR: 40,
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

interface HiClassHitSlot {
  rarity: string;
  pool?: Card[];
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

// 하이클래스 1팩: base cards + one or more hit slots.
function buildHiClassPack(ctx: BuildContext, hitSlots: HiClassHitSlot[], packSize: number): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  // 메가드림 ex(하이클래스) 전용: 정제된 C, U, R 카드를 모두 베이스로 사용 (타 확장팩 영향 X)
  const basePool = [...(byRarity['__null__'] || []), ...(byRarity['C'] || []), ...(byRarity['U'] || []), ...(byRarity['R'] || [])];
  const effectiveHitSlots = hitSlots.length > 0 ? hitSlots : [{ rarity: 'RR' }];
  const baseCount = Math.max(0, packSize - effectiveHitSlots.length);
  for (let i = 0; i < baseCount; i++) {
    if (basePool.length) cards.push(pick(basePool));
  }
  for (const hit of effectiveHitSlots) {
    const hitPool = hit.pool?.length ? hit.pool : (byRarity[hit.rarity] ?? byRarity['RR'] ?? basePool);
    if (hitPool.length) cards.push(pick(hitPool));
  }
  return { cards };
}

function buildHiClassPacksFromHits(
  ctx: BuildContext,
  rng: RNG,
  boxSize: number,
  packSize: number,
  hits: HiClassHitSlot[],
): PackResult[] {
  const packHits: HiClassHitSlot[][] = Array.from({ length: boxSize }, () => []);
  const shuffledHits = shuffle(hits, rng);

  shuffledHits.forEach((hit, i) => {
    const packIndex = i < boxSize ? i : Math.floor(rng() * boxSize);
    packHits[packIndex].push(hit);
  });

  return shuffle(packHits, rng).map((slots) => buildHiClassPack(ctx, slots, packSize));
}

function pickWeightedPool(
  ctx: BuildContext,
  weights: Record<string, number>,
  pools: Record<string, Card[]>,
  fallback: Card[],
): Card[] {
  const availableWeights: Record<string, number> = {};
  for (const [rarity, weight] of Object.entries(weights)) {
    if ((pools[rarity]?.length ?? 0) > 0) availableWeights[rarity] = weight;
  }
  if (Object.keys(availableWeights).length === 0) return fallback;
  const rarity = ctx.weightedPick(availableWeights);
  return pools[rarity] ?? fallback;
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
  const isMegaExpansion = Boolean(setCode?.startsWith('m'));
  const isSv11Special = setCode === 'sv11a-white-flare' || setCode === 'sv11b-black-bolt';

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

  // 슬롯 조립
  const slots: Card[][] = [];
  const arPool = byRarity['AR'] ?? [];
  const highPools: Record<string, Card[]> = {
    SR: isMegaExpansion ? (srPokemon.length ? [...srPokemon, ...srTrainer] : srAll) : srAll,
    SAR: isMegaExpansion ? (sarPokemon.length ? [...sarPokemon, ...sarTrainer] : sarAll) : sarAll,
    UR: isMegaExpansion && urPokemon.length ? urPokemon : urAll,
    BWR: bwrPokemon.length ? bwrPokemon : bwrAll,
  };

  if (isMegaExpansion) {
    // MEGA expansion: item/tool/stadium SR slot + separate Pokemon/supporter SR-or-better slot.
    const trainerSrPool = srTrainer.length ? srTrainer : srAll;
    if (trainerSrPool.length) slots.push(trainerSrPool);

    const highWeights = (setCode ? EXPANSION_MONSTER_WEIGHTS[setCode] : null) ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;
    slots.push(pickWeightedPool(ctx, highWeights, highPools, srAll.length ? srAll : (byRarity['RR'] ?? [])));
    slots.push(arPool, arPool, arPool);
    if (rng() < MEGA_EXTRA_SR_RATE && highPools.SR.length) slots.push(highPools.SR);
  } else {
    const highWeights = isSv11Special ? SV11_HIGH_WEIGHTS : STANDARD_SV_HIGH_WEIGHTS;
    slots.push(pickWeightedPool(ctx, highWeights, highPools, srAll.length ? srAll : (byRarity['RR'] ?? [])));
    const arCount = isSv11Special ? 4 : 3;
    for (let i = 0; i < arCount; i++) slots.push(arPool);
    const extraSrRate = isSv11Special
      ? SV11_EXTRA_SR_RATE
      : (setCode ? (EXTRA_SR_RATE_BY_SET[setCode] ?? STANDARD_EXTRA_SR_RATE) : STANDARD_EXTRA_SR_RATE);
    if (rng() < extraSrRate && srAll.length) slots.push(srAll);
  }

  const fillerWeights = isMegaExpansion
    ? MEGA_EXPANSION_FILLER_WEIGHTS
    : (boxSize === 20 ? STANDARD_20_PACK_FILLER_WEIGHTS : STANDARD_30_PACK_FILLER_WEIGHTS);
  while (slots.length < boxSize) {
    const r = ctx.weightedPick(fillerWeights);
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
  setCode?: string,
): PackResult[] {
  const { byRarity } = ctx;
  const isPokemon = (c: Card) => c.card_type === '포켓몬';
  const isTrainer = (c: Card) => c.card_type === '트레이너' || c.card_type === '에너지';

  if (setCode === 'sv8a-terastal-festa') {
    const sarAll = byRarity['SAR'] ?? [];
    const pokemonSar = sarAll.filter(isPokemon);
    const trainerSar = sarAll.filter(isTrainer);
    const hits: HiClassHitSlot[] = [];

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
    hits.push({ rarity: 'SAR', pool: pokemonSar.length ? pokemonSar : sarAll });

    if (rng() < TERASTAL_EXTRA_SLOT_RATE) {
      const extraRarity = ctx.weightedPick(filterAvailableWeights(TERASTAL_EXTRA_SLOT_WEIGHTS, byRarity));
      hits.push({
        rarity: extraRarity,
        pool: extraRarity === 'SAR' && trainerSar.length ? trainerSar : undefined,
      });
    }

    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  const hits: HiClassHitSlot[] = [];
  const isGodPack = rng() < HI_CLASS_GOD_PACK_RATE;

  if (isGodPack && hasRarity(byRarity, 'MA')) {
    // 갓팩 박스: AR×1 + MA×5 + SAR×4
    hits.push({ rarity: 'AR' });
    for (let i = 0; i < 5; i++) hits.push({ rarity: 'MA' });
    for (let i = 0; i < 4; i++) hits.push({ rarity: 'SAR' });
    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
  if (hasRarity(byRarity, 'AR')) {
    hits.push({ rarity: 'AR' }, { rarity: 'AR' }, { rarity: 'AR' });
  }
  if (hasRarity(byRarity, 'SR')) hits.push({ rarity: 'SR' });
  if (hasRarity(byRarity, 'MA')) hits.push({ rarity: 'MA' });

  const extraRarity = ctx.weightedPick(MEGA_DREAM_EXTRA_SLOT_WEIGHTS);
  if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
    hits.push({ rarity: extraRarity });
  }

  return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
}

// 자판기 1팩 모드 (D-128) — 박스 보장룰/갓팩 무시, 가중치만 적용.
// 가중치는 박스 평균 분포 기반 추정.
//   일반팩 박스(30팩) 평균 hit: R 18.75 / RR 6.25 / AR 3 / SR ~1.4 / SAR ~0.3 / MUR ~0.02
//   하이클래스 박스(10팩) 평균 hit: RR ~4.5 / MA ~1 / AR 3 / SR ~1.1 / SAR ~0.4 / MUR ~0.02
const EXPANSION_PACK_HIT_WEIGHTS: Record<string, number> = {
  R: 625,
  RR: 208,
  AR: 100,
  SR: 47,
  SAR: 10,
  UR: 1,
  BWR: 1,
};
const HI_CLASS_PACK_HIT_WEIGHTS: Record<string, number> = {
  RR: 450,
  MA: 100,
  AR: 300,
  SR: 110,
  SAR: 40,
  UR: 2,
};

function hasRarity(byRarity: Record<string, Card[]>, rarity: string): boolean {
  return (byRarity[rarity]?.length ?? 0) > 0;
}

function hiClassPackHitWeights(byRarity: Record<string, Card[]>): Record<string, number> {
  if (hasRarity(byRarity, 'MA')) {
    return HI_CLASS_PACK_HIT_WEIGHTS;
  }

  const { MA, RR, ...rest } = HI_CLASS_PACK_HIT_WEIGHTS;
  return { RR: RR + MA, ...rest };
}

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
    type === 'hi-class' ? hiClassPackHitWeights(byRarity) : EXPANSION_PACK_HIT_WEIGHTS;

  const filtered = filterAvailableWeights(hitWeights, byRarity);
  const hitRarity = ctx.weightedPick(filtered);

  const pack =
    type === 'hi-class'
      ? buildHiClassPack(ctx, [{ rarity: hitRarity }], packSize)
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
      ? simulateHiClassBox(boxSize, packSize, ctx, rng, setCode)
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
