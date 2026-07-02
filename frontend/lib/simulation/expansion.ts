import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  ANNIVERSARY_25_BASE_RARITY,
  ANNIVERSARY_25_HIT_WEIGHTS,
  ANNIVERSARY_25_PROMO_INTERVAL,
  ANNIVERSARY_25_PROMO_RARITY,
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
  ALT_SR_NUMBER_RANGES,
  MEGA_EXTRA_SR_RATE,
  MEGA_MAIN_SR_NUMBER_RANGES,
  MEGA_RR_BASE_COUNT,
  MEGA_RR_EXTRA_RATE,
  SV11_AR_COUNT,
  SV11_EXTRA_SR_RATE,
  SV11_OPTIONAL_TOP_WEIGHTS,
  SV11_RR_COUNT,
  getStandardSvSetRate,
  hasAceSpecSlot,
  isAnniversary25Set,
  isMegaExpansionSet,
  isSv11SpecialSet,
} from './model';
import { buildExpansionPack } from './pack-builders';
import {
  getRarityPools,
  pickWeightedHitPool,
  pickWeightedPool,
} from './pools';
import type { RarityPools } from './pools';
import type { BuildContext, StandardHighKey, StandardSvSetRate } from './types';
import { pickUniqueCard, UNIQUE_BOX_HIT_RARITIES } from './unique';

export function simulateExpansionBox(
  _allCards: Card[],
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
  packSize = 5,
): PackResult[] {
  if (isAnniversary25Set(setCode)) {
    const packs = Array.from({ length: boxSize }, () => buildAnniversary25Pack(ctx, rng, packSize));
    for (let index = ANNIVERSARY_25_PROMO_INTERVAL - 1; index < packs.length; index += ANNIVERSARY_25_PROMO_INTERVAL) {
      packs[index] = maybeAppendAnniversary25Promo(packs[index], ctx, rng);
    }
    return packs;
  }

  const slots = resolveUniqueExpansionSlots(ctx, buildExpansionBoxHitSlots(boxSize, ctx, rng, setCode));
  return shuffle(slots, rng).map((pool) => (
    setCode === 'smp2-detective-pikachu'
      ? buildDetectivePikachuPack(ctx, pool, packSize)
      : setCode === 'sm9a-night-unison'
        ? buildNightUnisonPack(ctx, pool, packSize)
        : buildExpansionPack(ctx, pool, packSize)
  ));
}

export function buildAnniversary25Pack(ctx: BuildContext, rng: RNG, packSize = 5): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const anniversaryPool = byRarity[ANNIVERSARY_25_BASE_RARITY] ?? [];
  const unmarked = byRarity.__null__ ?? [];
  const baseCards = anniversaryPool.length ? anniversaryPool : unmarked;
  const isEnergy = (card: Card) => card.card_type === '에너지';
  const energyPool = baseCards.filter(isEnergy);
  const nonEnergyCount = Math.max(0, packSize - (energyPool.length ? 1 : 0));

  for (let i = 0; i < nonEnergyCount; i++) {
    const slotPool = anniversary25HitPool(ctx);
    if (slotPool.length) cards.push(pick(slotPool));
  }

  if (energyPool.length) cards.push(pick(energyPool));

  return { cards: shuffle(cards, rng) };
}

export function maybeAppendAnniversary25Promo(
  pack: PackResult,
  ctx: BuildContext,
  rng: RNG,
  chance = 1,
): PackResult {
  if (rng() >= chance) return pack;

  const promoPool = ctx.byRarity[ANNIVERSARY_25_PROMO_RARITY] ?? [];
  if (!promoPool.length) return pack;

  return { cards: [...pack.cards, ctx.pick(promoPool)] };
}

function anniversary25HitPool(ctx: BuildContext): Card[] {
  const { byRarity } = ctx;
  const anniversaryPool = byRarity[ANNIVERSARY_25_BASE_RARITY] ?? byRarity.__null__ ?? [];
  const basePool = anniversaryPool.filter((card) => card.card_type !== '에너지');
  const entries = [
    { weight: ANNIVERSARY_25_HIT_WEIGHTS['25TH'], pool: basePool },
    { weight: ANNIVERSARY_25_HIT_WEIGHTS.RR, pool: byRarity.RR ?? [] },
    { weight: ANNIVERSARY_25_HIT_WEIGHTS.RRR, pool: byRarity.RRR ?? [] },
  ];

  return pickWeightedHitPool(ctx, entries, basePool.length ? basePool : (byRarity.RRR ?? byRarity.RR ?? byRarity.__null__ ?? []));
}

function buildExpansionBoxHitSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
): Card[][] {
  const isMegaExpansion = isMegaExpansionSet(setCode);
  const isSv11Special = isSv11SpecialSet(setCode);
  const standardSetRate = getStandardSvSetRate(setCode);

  if (setCode === 'smp2-detective-pikachu') {
    return buildDetectivePikachuSlots(boxSize, ctx);
  }

  if (isMegaExpansion) {
    return buildMegaExpansionSlots(boxSize, ctx, rng, setCode);
  }

  if (isSv11Special) {
    return buildSv11SpecialSlots(boxSize, ctx, rng);
  }

  if (standardSetRate) {
    return buildStandardSvSlots(boxSize, ctx, rng, standardSetRate, setCode);
  }

  return buildFallbackExpansionSlots(boxSize, ctx, rng, setCode);
}

export function buildDetectivePikachuPack(
  ctx: BuildContext,
  hitPool: Card[],
  packSize = 5,
): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const regularC = (byRarity.C ?? []).filter((card) => card.subtype !== '미러');
  const regularU = (byRarity.U ?? []).filter((card) => card.subtype !== '미러');

  for (let i = 0; i < packSize - 2; i++) {
    if (regularC.length) cards.push(pick(regularC));
  }
  if (regularU.length) cards.push(pick(regularU));
  if (hitPool.length) cards.push(pick(hitPool));

  return { cards };
}

export function buildNightUnisonPack(
  ctx: BuildContext,
  hitPool: Card[],
  packSize = 8,
): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const regularC = (byRarity.C ?? []).filter((card) => card.subtype !== '미러');
  const regularU = (byRarity.U ?? []).filter((card) => card.subtype !== '미러');
  const mirrorPool = [
    ...(byRarity.C ?? []).filter((card) => card.subtype === '미러'),
    ...(byRarity.U ?? []).filter((card) => card.subtype === '미러'),
  ];

  for (let i = 0; i < packSize - 3; i++) {
    if (regularC.length) cards.push(pick(regularC));
  }
  if (regularU.length) cards.push(pick(regularU));
  if (mirrorPool.length) cards.push(pick(mirrorPool));
  if (hitPool.length) cards.push(pick(hitPool));

  return { cards };
}

function buildDetectivePikachuSlots(
  boxSize: number,
  ctx: BuildContext,
): Card[][] {
  const { byRarity } = ctx;
  const slots: Card[][] = [];
  const srPool = byRarity.SR ?? [];
  if (srPool.length) slots.push(srPool);

  const holoPool = [
    ...(byRarity.C ?? []).filter((card) => card.subtype === '미러'),
    ...(byRarity.U ?? []).filter((card) => card.subtype === '미러'),
    ...(byRarity.RR ?? []),
  ];
  const holoSlots = Math.max(0, boxSize - slots.length);
  for (let i = 0; i < holoSlots; i++) {
    if (holoPool.length) slots.push(holoPool);
  }

  return slots;
}

function buildStandardSvSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  rate: StandardSvSetRate,
  setCode?: string,
): Card[][] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const standardHighPools = getStandardHighPools(pools, setCode);
  const slots: Card[][] = [];

  slots.push(pickWeightedPool(
    ctx,
    rate.mandatoryHighWeights,
    standardHighPools,
    pools.srAll.length ? pools.srAll : (byRarity.RR ?? []),
  ));

  if (hasAceSpecSlot(setCode) && byRarity.ACE?.length) slots.push(byRarity.ACE);
  for (let i = 0; i < (rate.kCount ?? 0); i++) {
    if (pools.kAll.length) slots.push(pools.kAll);
  }
  for (let i = 0; i < (rate.chrCount ?? 0); i++) {
    if (pools.chrAll.length) slots.push(pools.chrAll);
  }
  for (let i = 0; i < (rate.trCount ?? 0); i++) {
    if (pools.trAll.length) slots.push(pools.trAll);
  }
  if (rng() < (rate.trExtraRate ?? 0) && pools.trAll.length) slots.push(pools.trAll);
  for (let i = 0; i < (rate.aCount ?? 0); i++) {
    if (pools.aPool.length) slots.push(pools.aPool);
  }
  for (let i = 0; i < (rate.arCount ?? 3); i++) slots.push(pools.arPool);

  if (rng() < rate.extraHighRate && pools.srAll.length) {
    slots.push(pickWeightedPool(ctx, rate.extraHighWeights, standardHighPools, pools.srAll));
  }

  const rrPool = byRarity.RR ?? byRarity.R ?? [];
  const rrCount = rate.rrBaseCount + (rng() < rate.rrExtraRate ? 1 : 0);
  for (let i = 0; i < rrCount; i++) slots.push(rrPool);

  const rrrPool = byRarity.RRR ?? [];
  const rrrCount = (rate.rrrBaseCount ?? 0) + (rng() < (rate.rrrExtraRate ?? 0) ? 1 : 0);
  const shuffledRrrPool = shuffle(rrrPool, rng);
  const cycleDistinctRrr = setCode === 's1w-sword'
    || setCode === 's1h-shield'
    || setCode === 's1a-vmax-rising';
  for (let i = 0; i < rrrCount; i++) {
    if (cycleDistinctRrr && shuffledRrrPool.length) {
      slots.push([shuffledRrrPool[i % shuffledRrrPool.length]]);
    } else {
      slots.push(rrrPool);
    }
  }

  const rPool = byRarity.R ?? byRarity.RR ?? [];
  while (slots.length < boxSize) slots.push(rPool);

  return slots;
}

function buildSv11SpecialSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
): Card[][] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const slots: Card[][] = [];

  if (pools.srAll.length) slots.push(pools.srAll);

  const optionalTop = ctx.weightedPick(SV11_OPTIONAL_TOP_WEIGHTS);
  if (optionalTop === 'SAR' && pools.sarAll.length) slots.push(pools.sarAll);
  if (optionalTop === 'BWR' && pools.bwrAll.length) slots.push(pools.bwrAll);

  if (rng() < SV11_EXTRA_SR_RATE && pools.srAll.length) slots.push(pools.srAll);

  for (let i = 0; i < SV11_AR_COUNT; i++) slots.push(pools.arPool);

  const rrPool = byRarity.RR ?? byRarity.R ?? [];
  for (let i = 0; i < SV11_RR_COUNT; i++) slots.push(rrPool);

  const rPool = byRarity.R ?? byRarity.RR ?? [];
  while (slots.length < boxSize) slots.push(rPool);

  return slots;
}

function buildMegaExpansionSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
): Card[][] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const mainSrPool = getMegaMainSrPool(setCode, pools.srAll);
  const fixedSrPool = getMegaFixedSrPool(setCode, pools.srAll);
  const slots: Card[][] = [];
  const highPools: Record<string, Card[]> = {
    SR: mainSrPool,
    SAR: pools.sarAll,
    UR: pools.urPokemon.length ? pools.urPokemon : pools.urAll,
    BWR: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll,
  };

  if (fixedSrPool.length) slots.push(fixedSrPool);

  const highWeights = (setCode ? EXPANSION_MONSTER_WEIGHTS[setCode] : null) ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;
  const mainHighFallback = mainSrPool.length
    ? mainSrPool
    : (pools.sarAll.length ? pools.sarAll : (pools.urPokemon.length ? pools.urPokemon : (byRarity.RR ?? [])));

  slots.push(pickWeightedPool(ctx, highWeights, highPools, mainHighFallback));
  slots.push(pools.arPool, pools.arPool, pools.arPool);

  if (rng() < MEGA_EXTRA_SR_RATE && mainSrPool.length) slots.push(mainSrPool);

  const rrPool = byRarity.RR ?? byRarity.R ?? [];
  const rrCount = MEGA_RR_BASE_COUNT + (rng() < MEGA_RR_EXTRA_RATE ? 1 : 0);
  for (let i = 0; i < rrCount; i++) slots.push(rrPool);

  const rPool = byRarity.R ?? byRarity.RR ?? [];
  while (slots.length < boxSize) slots.push(rPool);

  return slots;
}

export function expansionPackHitPool(ctx: BuildContext, setCode?: string): Card[] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const isMegaExpansion = isMegaExpansionSet(setCode);
  const isSv11Special = isSv11SpecialSet(setCode);
  const standardSetRate = getStandardSvSetRate(setCode);
  const entries: { weight: number; pool: Card[] }[] = [];

  if (isAnniversary25Set(setCode)) {
    return anniversary25HitPool(ctx);
  }

  if (setCode === 'smp2-detective-pikachu') {
    entries.push({ weight: 100, pool: byRarity.SR ?? [] });
    entries.push({
      weight: 1187.5,
      pool: (byRarity.C ?? []).filter((card) => card.subtype === '미러'),
    });
    entries.push({
      weight: 475,
      pool: (byRarity.U ?? []).filter((card) => card.subtype === '미러'),
    });
    entries.push({ weight: 237.5, pool: byRarity.RR ?? [] });
    return pickWeightedHitPool(ctx, entries, byRarity.U ?? byRarity.C ?? []);
  }

  if (isMegaExpansion) {
    const highWeights = (setCode ? EXPANSION_MONSTER_WEIGHTS[setCode] : null) ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;
    const mainSrPool = getMegaMainSrPool(setCode, pools.srAll);
    const fixedSrPool = getMegaFixedSrPool(setCode, pools.srAll);
    const rrExpected = MEGA_RR_BASE_COUNT + MEGA_RR_EXTRA_RATE;
    const rSlots = 30 - 1 - 1 - 3 - MEGA_EXTRA_SR_RATE - rrExpected;
    entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
    entries.push({ weight: rrExpected * 100, pool: byRarity.RR ?? [] });
    entries.push({ weight: 300, pool: pools.arPool });
    entries.push({ weight: 100, pool: fixedSrPool });
    entries.push({ weight: highWeights.SR ?? 0, pool: mainSrPool });
    entries.push({ weight: highWeights.SAR ?? 0, pool: pools.sarAll });
    entries.push({ weight: highWeights.UR ?? 0, pool: pools.urPokemon.length ? pools.urPokemon : pools.urAll });
    entries.push({ weight: MEGA_EXTRA_SR_RATE * 100, pool: mainSrPool });
    return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
  }

  const defaultBoxSize = isSv11Special ? 20 : getStandardExpansionBoxSize(setCode);
  const aceCount = hasAceSpecSlot(setCode) && byRarity.ACE?.length ? 1 : 0;

  if (isSv11Special) {
    const optionalTopTotal = Object.values(SV11_OPTIONAL_TOP_WEIGHTS).reduce((a, b) => a + b, 0);
    const optionalSar = SV11_OPTIONAL_TOP_WEIGHTS.SAR / optionalTopTotal;
    const optionalBwr = SV11_OPTIONAL_TOP_WEIGHTS.BWR / optionalTopTotal;
    const rSlots = defaultBoxSize - 1 - SV11_EXTRA_SR_RATE - optionalSar - optionalBwr - SV11_AR_COUNT - SV11_RR_COUNT;

    entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
    entries.push({ weight: SV11_RR_COUNT * 100, pool: byRarity.RR ?? [] });
    entries.push({ weight: SV11_AR_COUNT * 100, pool: pools.arPool });
    entries.push({ weight: (1 + SV11_EXTRA_SR_RATE) * 100, pool: pools.srAll });
    entries.push({ weight: optionalSar * 100, pool: pools.sarAll });
    entries.push({ weight: optionalBwr * 100, pool: pools.bwrAll });
    return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
  }

  if (!standardSetRate) return fallbackExpansionPackHitPool(ctx, setCode);

  const boxSize = standardSetRate.boxSize ?? defaultBoxSize;
  const arCount = standardSetRate.arCount ?? 3;
  const aCount = standardSetRate.aCount ?? 0;
  const kCount = standardSetRate.kCount ?? 0;
  const chrCount = standardSetRate.chrCount ?? 0;
  const trCount = (standardSetRate.trCount ?? 0) + (standardSetRate.trExtraRate ?? 0);
  const extraSrRate = standardSetRate.extraHighRate;
  const rrExpected = standardSetRate.rrBaseCount + standardSetRate.rrExtraRate;
  const rrrExpected = (standardSetRate.rrrBaseCount ?? 0) + (standardSetRate.rrrExtraRate ?? 0);
  const rSlots = boxSize - 1 - aceCount - kCount - chrCount - trCount - aCount - arCount - extraSrRate - rrExpected - rrrExpected;

  entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
  entries.push({ weight: rrExpected * 100, pool: byRarity.RR ?? [] });
  if (rrrExpected > 0) entries.push({ weight: rrrExpected * 100, pool: byRarity.RRR ?? [] });
  if (aceCount > 0) entries.push({ weight: aceCount * 100, pool: byRarity.ACE ?? [] });
  if (kCount > 0) entries.push({ weight: kCount * 100, pool: pools.kAll });
  if (chrCount > 0) entries.push({ weight: chrCount * 100, pool: pools.chrAll });
  if (trCount > 0) entries.push({ weight: trCount * 100, pool: pools.trAll });
  if (aCount > 0) entries.push({ weight: aCount * 100, pool: pools.aPool });
  if (arCount > 0) entries.push({ weight: arCount * 100, pool: pools.arPool });

  const standardHighPools = getStandardHighPools(pools, setCode);
  const combinedHighWeights: Partial<Record<StandardHighKey, number>> = { ...standardSetRate.mandatoryHighWeights };
  for (const [key, weight] of Object.entries(standardSetRate.extraHighWeights) as [StandardHighKey, number][]) {
    combinedHighWeights[key] = (combinedHighWeights[key] ?? 0) + extraSrRate * weight;
  }
  for (const [key, weight] of Object.entries(combinedHighWeights) as [StandardHighKey, number][]) {
    entries.push({ weight, pool: standardHighPools[key] ?? [] });
  }

  return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
}

function buildFallbackExpansionSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
): Card[][] {
  const { byRarity } = ctx;
  const fallbackRate: StandardSvSetRate = {
    mandatoryHighWeights: { SR_POKEMON: 48.125, SR_TRAINER: 21.875, SAR: 20, UR: 10 },
    extraHighRate: 0.1,
    extraHighWeights: { SR_POKEMON: 68.75, SR_TRAINER: 31.25 },
    rrBaseCount: 4,
    rrExtraRate: 0.1,
    fillerWeights: { R: 84.17, RR: 15.83 },
  };

  if (hasAceSpecSlot(setCode) && !byRarity.ACE?.length) {
    return buildStandardSvSlots(boxSize, ctx, rng, fallbackRate);
  }

  return buildStandardSvSlots(boxSize, ctx, rng, fallbackRate, setCode);
}

function fallbackExpansionPackHitPool(ctx: BuildContext, setCode?: string): Card[] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const entries: { weight: number; pool: Card[] }[] = [];
  const boxSize = getStandardExpansionBoxSize(setCode);
  const aceCount = hasAceSpecSlot(setCode) && byRarity.ACE?.length ? 1 : 0;
  const arCount = 3;
  const rrExpected = 4.1;
  const extraSrRate = 0.1;
  const rSlots = boxSize - 1 - aceCount - arCount - extraSrRate - rrExpected;

  entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
  entries.push({ weight: rrExpected * 100, pool: byRarity.RR ?? [] });
  if (aceCount > 0) entries.push({ weight: aceCount * 100, pool: byRarity.ACE ?? [] });
  entries.push({ weight: arCount * 100, pool: pools.arPool });
  entries.push({ weight: 55, pool: pools.srPokemon.length ? pools.srPokemon : pools.srAll });
  entries.push({ weight: 25, pool: pools.srTrainer.length ? pools.srTrainer : pools.srAll });
  entries.push({ weight: 20, pool: pools.sarAll });
  entries.push({ weight: 10, pool: pools.urAll });

  return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
}

function resolveUniqueExpansionSlots(ctx: BuildContext, slots: Card[][]): Card[][] {
  const usedCardNums = new Set<string>();

  return slots.map((pool) => {
    if (!isUniqueExpansionSlot(pool)) return pool;

    const card = pickUniqueCard(ctx, pool, usedCardNums);
    return card ? [card] : pool;
  });
}

function isUniqueExpansionSlot(pool: Card[]): boolean {
  return pool.length > 0
    && pool.every((card) => card.rarity !== null && UNIQUE_BOX_HIT_RARITIES.has(card.rarity));
}

function getMegaMainSrPool(setCode: string | undefined, srAll: Card[]): Card[] {
  const ranges = setCode ? MEGA_MAIN_SR_NUMBER_RANGES[setCode] : undefined;
  if (!ranges) return srAll;
  return srAll.filter((card) => isInRanges(card.number, ranges));
}

function getMegaFixedSrPool(setCode: string | undefined, srAll: Card[]): Card[] {
  const ranges = setCode ? MEGA_MAIN_SR_NUMBER_RANGES[setCode] : undefined;
  if (!ranges) return [];
  return srAll.filter((card) => !isInRanges(card.number, ranges));
}

function isInRanges(number: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => number >= start && number <= end);
}

function getStandardHighPools(pools: RarityPools, setCode?: string): Record<StandardHighKey, Card[]> {
  const altRanges = setCode ? ALT_SR_NUMBER_RANGES[setCode] : undefined;
  const srAlt = altRanges ? pools.srPokemon.filter((card) => isInRanges(card.number, altRanges)) : [];
  const srPokemon = altRanges
    ? pools.srPokemon.filter((card) => !isInRanges(card.number, altRanges))
    : pools.srPokemon;

  return {
    SR_POKEMON: srPokemon.length ? srPokemon : pools.srAll,
    SR_ALT: srAlt,
    SR_TRAINER: pools.srTrainer.length ? pools.srTrainer : pools.srAll,
    HR_POKEMON: pools.hrPokemon.length ? pools.hrPokemon : pools.hrAll,
    HR_TRAINER: pools.hrTrainer.length ? pools.hrTrainer : pools.hrAll,
    CSR: pools.csrPokemon.length ? pools.csrPokemon : pools.csrAll,
    SAR: pools.sarAll,
    UR: pools.urAll,
    GRA: pools.graAll,
    BWR: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll,
  };
}

function getStandardExpansionBoxSize(setCode?: string): number {
  if (setCode === 'sv2a-151' || setCode === 's10b-pokemon-go' || setCode === 's9a-battle-region') return 20;
  return 30;
}
