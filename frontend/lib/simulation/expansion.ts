import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
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
  isMegaExpansionSet,
  isSv11SpecialSet,
} from './model';
import { buildExpansionPack } from './pack-builders';
import {
  getRarityPools,
  pickWeightedHitPool,
  pickWeightedPool,
} from './pools';
import type { BuildContext, StandardHighKey, StandardSvSetRate } from './types';

export function simulateExpansionBox(
  _allCards: Card[],
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
  packSize = 5,
): PackResult[] {
  const slots = buildExpansionBoxHitSlots(boxSize, ctx, rng, setCode);
  return shuffle(slots, rng).map((pool) => buildExpansionPack(ctx, pool, packSize));
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

function buildStandardSvSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  rate: StandardSvSetRate,
  setCode?: string,
): Card[][] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const slots: Card[][] = [];
  const standardHighPools: Record<StandardHighKey, Card[]> = {
    SR_POKEMON: pools.srPokemon.length ? pools.srPokemon : pools.srAll,
    SR_TRAINER: pools.srTrainer.length ? pools.srTrainer : pools.srAll,
    SAR: pools.sarAll,
    UR: pools.urAll,
    BWR: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll,
  };

  slots.push(pickWeightedPool(
    ctx,
    rate.mandatoryHighWeights,
    standardHighPools,
    pools.srAll.length ? pools.srAll : (byRarity.RR ?? []),
  ));

  if (hasAceSpecSlot(setCode) && byRarity.ACE?.length) slots.push(byRarity.ACE);
  for (let i = 0; i < (rate.arCount ?? 3); i++) slots.push(pools.arPool);

  if (rng() < rate.extraHighRate && pools.srAll.length) {
    slots.push(pickWeightedPool(ctx, rate.extraHighWeights, standardHighPools, pools.srAll));
  }

  const rrPool = byRarity.RR ?? byRarity.R ?? [];
  const rrCount = rate.rrBaseCount + (rng() < rate.rrExtraRate ? 1 : 0);
  for (let i = 0; i < rrCount; i++) slots.push(rrPool);

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

  const boxSize = isSv11Special || setCode === 'sv2a-151' ? 20 : 30;
  const aceCount = hasAceSpecSlot(setCode) && byRarity.ACE?.length ? 1 : 0;

  if (isSv11Special) {
    const optionalTopTotal = Object.values(SV11_OPTIONAL_TOP_WEIGHTS).reduce((a, b) => a + b, 0);
    const optionalSar = SV11_OPTIONAL_TOP_WEIGHTS.SAR / optionalTopTotal;
    const optionalBwr = SV11_OPTIONAL_TOP_WEIGHTS.BWR / optionalTopTotal;
    const rSlots = boxSize - 1 - SV11_EXTRA_SR_RATE - optionalSar - optionalBwr - SV11_AR_COUNT - SV11_RR_COUNT;

    entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
    entries.push({ weight: SV11_RR_COUNT * 100, pool: byRarity.RR ?? [] });
    entries.push({ weight: SV11_AR_COUNT * 100, pool: pools.arPool });
    entries.push({ weight: (1 + SV11_EXTRA_SR_RATE) * 100, pool: pools.srAll });
    entries.push({ weight: optionalSar * 100, pool: pools.sarAll });
    entries.push({ weight: optionalBwr * 100, pool: pools.bwrAll });
    return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
  }

  if (!standardSetRate) return fallbackExpansionPackHitPool(ctx, setCode);

  const arCount = standardSetRate.arCount ?? 3;
  const extraSrRate = standardSetRate.extraHighRate;
  const rrExpected = standardSetRate.rrBaseCount + standardSetRate.rrExtraRate;
  const rSlots = boxSize - 1 - aceCount - arCount - extraSrRate - rrExpected;

  entries.push({ weight: rSlots * 100, pool: byRarity.R ?? [] });
  entries.push({ weight: rrExpected * 100, pool: byRarity.RR ?? [] });
  if (aceCount > 0) entries.push({ weight: aceCount * 100, pool: byRarity.ACE ?? [] });
  entries.push({ weight: arCount * 100, pool: pools.arPool });

  entries.push({
    weight: (standardSetRate.mandatoryHighWeights.SR_POKEMON ?? 0) + extraSrRate * standardSetRate.extraHighWeights.SR_POKEMON,
    pool: pools.srPokemon.length ? pools.srPokemon : pools.srAll,
  });
  entries.push({
    weight: (standardSetRate.mandatoryHighWeights.SR_TRAINER ?? 0) + extraSrRate * standardSetRate.extraHighWeights.SR_TRAINER,
    pool: pools.srTrainer.length ? pools.srTrainer : pools.srAll,
  });
  entries.push({ weight: standardSetRate.mandatoryHighWeights.SAR ?? 0, pool: pools.sarAll });
  entries.push({ weight: standardSetRate.mandatoryHighWeights.UR ?? 0, pool: pools.urAll });
  entries.push({ weight: standardSetRate.mandatoryHighWeights.BWR ?? 0, pool: pools.bwrAll });

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
  const boxSize = setCode === 'sv2a-151' ? 20 : 30;
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
