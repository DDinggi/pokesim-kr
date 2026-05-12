import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
  MEGA_EXPANSION_FILLER_WEIGHTS,
  MEGA_EXTRA_SR_RATE,
  MEGA_TRAINER_SLOT_WEIGHTS,
  STANDARD_20_PACK_FILLER_WEIGHTS,
  STANDARD_30_PACK_FILLER_WEIGHTS,
  STANDARD_SV_HIGH_WEIGHTS,
  SV11_HIGH_WEIGHTS,
  getExtraSrRate,
  getStandardSvSetRate,
  hasAceSpecSlot,
  isMegaExpansionSet,
  isSv11SpecialSet,
} from './model';
import { buildExpansionPack } from './pack-builders';
import {
  addFillerPackEntries,
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
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const isMegaExpansion = isMegaExpansionSet(setCode);
  const isSv11Special = isSv11SpecialSet(setCode);
  const standardSetRate = getStandardSvSetRate(setCode);

  if (isMegaExpansion) {
    return buildMegaExpansionSlots(boxSize, ctx, rng, setCode);
  }

  if (standardSetRate) {
    return buildStandardSvSlots(boxSize, ctx, rng, standardSetRate, setCode);
  }

  const slots: Card[][] = [];
  const highPools: Record<string, Card[]> = {
    SR: pools.srAll,
    SAR: pools.sarAll,
    UR: pools.urAll,
    BWR: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll,
  };
  const highWeights = isSv11Special ? SV11_HIGH_WEIGHTS : STANDARD_SV_HIGH_WEIGHTS;

  slots.push(pickWeightedPool(ctx, highWeights, highPools, pools.srAll.length ? pools.srAll : (byRarity.RR ?? [])));

  if (hasAceSpecSlot(setCode) && byRarity.ACE?.length) slots.push(byRarity.ACE);

  const arCount = isSv11Special ? 4 : 3;
  for (let i = 0; i < arCount; i++) slots.push(pools.arPool);

  const extraSrRate = getExtraSrRate(setCode, isSv11Special);
  if (rng() < extraSrRate && pools.srAll.length) slots.push(pools.srAll);

  const fillerWeights = boxSize === 20 ? STANDARD_20_PACK_FILLER_WEIGHTS : STANDARD_30_PACK_FILLER_WEIGHTS;
  while (slots.length < boxSize) {
    const rarity = ctx.weightedPick(fillerWeights);
    slots.push(byRarity[rarity] ?? byRarity.R ?? []);
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
  const slots: Card[][] = [];
  const standardHighPools: Record<StandardHighKey, Card[]> = {
    SR_POKEMON: pools.srPokemon.length ? pools.srPokemon : pools.srAll,
    SR_TRAINER: pools.srTrainer.length ? pools.srTrainer : pools.srAll,
    SAR: pools.sarAll,
    UR: pools.urAll,
  };

  slots.push(pickWeightedPool(
    ctx,
    rate.mandatoryHighWeights,
    standardHighPools,
    pools.srAll.length ? pools.srAll : (byRarity.RR ?? []),
  ));

  if (hasAceSpecSlot(setCode) && byRarity.ACE?.length) slots.push(byRarity.ACE);
  for (let i = 0; i < 3; i++) slots.push(pools.arPool);

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

function buildMegaExpansionSlots(
  boxSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
): Card[][] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const slots: Card[][] = [];
  const highPools: Record<string, Card[]> = {
    SR: pools.srPokemon,
    SAR: pools.sarPokemon,
    UR: pools.urPokemon.length ? pools.urPokemon : pools.urAll,
    BWR: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll,
  };
  const trainerPools: Record<string, Card[]> = {
    SR: pools.srTrainer,
    SAR: pools.sarTrainer,
  };
  const trainerFallback = pools.srTrainer.length
    ? pools.srTrainer
    : (pools.sarTrainer.length ? pools.sarTrainer : pools.srAll);

  if (trainerFallback.length) {
    slots.push(pickWeightedPool(ctx, MEGA_TRAINER_SLOT_WEIGHTS, trainerPools, trainerFallback));
  }

  const highWeights = (setCode ? EXPANSION_MONSTER_WEIGHTS[setCode] : null) ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;
  const pokemonHighFallback = pools.srPokemon.length
    ? pools.srPokemon
    : (pools.sarPokemon.length ? pools.sarPokemon : (pools.urPokemon.length ? pools.urPokemon : (byRarity.RR ?? [])));

  slots.push(pickWeightedPool(ctx, highWeights, highPools, pokemonHighFallback));
  slots.push(pools.arPool, pools.arPool, pools.arPool);

  if (rng() < MEGA_EXTRA_SR_RATE && pools.srPokemon.length) slots.push(pools.srPokemon);

  while (slots.length < boxSize) {
    const rarity = ctx.weightedPick(MEGA_EXPANSION_FILLER_WEIGHTS);
    slots.push(byRarity[rarity] ?? byRarity.R ?? []);
  }

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
    addFillerPackEntries(entries, byRarity, 30 - 1 - 1 - 3 - MEGA_EXTRA_SR_RATE, MEGA_EXPANSION_FILLER_WEIGHTS);
    entries.push({ weight: 300, pool: pools.arPool });
    entries.push({ weight: MEGA_TRAINER_SLOT_WEIGHTS.SR, pool: pools.srTrainer });
    entries.push({ weight: MEGA_TRAINER_SLOT_WEIGHTS.SAR, pool: pools.sarTrainer });
    entries.push({ weight: highWeights.SR ?? 0, pool: pools.srPokemon });
    entries.push({ weight: highWeights.SAR ?? 0, pool: pools.sarPokemon });
    entries.push({ weight: highWeights.UR ?? 0, pool: pools.urPokemon.length ? pools.urPokemon : pools.urAll });
    entries.push({ weight: MEGA_EXTRA_SR_RATE * 100, pool: pools.srPokemon });
    return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
  }

  const boxSize = isSv11Special || setCode === 'sv2a-151' ? 20 : 30;
  const arCount = isSv11Special ? 4 : 3;
  const aceCount = hasAceSpecSlot(setCode) ? 1 : 0;
  const extraSrRate = getExtraSrRate(setCode, isSv11Special);
  const highWeights = isSv11Special ? SV11_HIGH_WEIGHTS : STANDARD_SV_HIGH_WEIGHTS;
  const fillerWeights = standardSetRate?.fillerWeights ?? (boxSize === 20 ? STANDARD_20_PACK_FILLER_WEIGHTS : STANDARD_30_PACK_FILLER_WEIGHTS);

  addFillerPackEntries(entries, byRarity, boxSize - 1 - aceCount - arCount - extraSrRate, fillerWeights);
  if (aceCount > 0) entries.push({ weight: aceCount * 100, pool: byRarity.ACE ?? [] });
  entries.push({ weight: arCount * 100, pool: pools.arPool });

  if (standardSetRate) {
    entries.push({
      weight: standardSetRate.mandatoryHighWeights.SR_POKEMON + extraSrRate * (standardSetRate.extraHighWeights.SR_POKEMON / 100),
      pool: pools.srPokemon.length ? pools.srPokemon : pools.srAll,
    });
    entries.push({
      weight: standardSetRate.mandatoryHighWeights.SR_TRAINER + extraSrRate * (standardSetRate.extraHighWeights.SR_TRAINER / 100),
      pool: pools.srTrainer.length ? pools.srTrainer : pools.srAll,
    });
    entries.push({ weight: standardSetRate.mandatoryHighWeights.SAR, pool: pools.sarAll });
    entries.push({ weight: standardSetRate.mandatoryHighWeights.UR, pool: pools.urAll });
  } else {
    entries.push({ weight: (highWeights.SR ?? 0) + extraSrRate * 100, pool: pools.srAll });
    entries.push({ weight: highWeights.SAR ?? 0, pool: pools.sarAll });
    entries.push({ weight: highWeights.UR ?? 0, pool: pools.urAll });
    entries.push({ weight: highWeights.BWR ?? 0, pool: pools.bwrPokemon.length ? pools.bwrPokemon : pools.bwrAll });
  }

  return pickWeightedHitPool(ctx, entries, byRarity.R ?? []);
}
