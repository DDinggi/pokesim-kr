import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  HI_CLASS_GOD_PACK_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_MAIN_SR_NUMBER_RANGES,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
  VSTAR_UNIVERSE_AR_GOD_PACK_RATE,
  VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS,
  VSTAR_UNIVERSE_SAR_GOD_PACK_RATE,
} from './model';
import { buildHiClassPack, buildHiClassPacksFromHits } from './pack-builders';
import {
  getRarityPools,
  hasRarity,
} from './pools';
import type { BuildContext, HiClassHitSlot } from './types';

const HI_CLASS_BOX_SIZE = 10;

export function simulateHiClassBox(
  boxSize: number,
  packSize: number,
  ctx: BuildContext,
  rng: RNG,
  setCode?: string,
): PackResult[] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);

  if (setCode === 'sv8a-terastal-festa') {
    const pokemonSar = pools.sarAll.filter((card) => card.card_type === '포켓몬');
    const trainerSar = pools.sarAll.filter((card) => card.card_type === '트레이너' || card.card_type === '에너지');
    const hits: HiClassHitSlot[] = [];

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
    hits.push({ rarity: 'SAR', pool: pokemonSar.length ? pokemonSar : pools.sarAll });

    const extraRarity = ctx.weightedPick(TERASTAL_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({
        rarity: extraRarity,
        pool: extraRarity === 'SAR' && trainerSar.length ? trainerSar : undefined,
      });
    }

    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  if (setCode === 'sv4a-shiny-treasure-ex') {
    const sarPool = pools.sarAll;
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
    if (ssrPool.length) hits.push({ rarity: 'SSR', pool: ssrPool });

    const extraRarity = ctx.weightedPick(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({
        rarity: extraRarity,
        pool: extraRarity === 'SAR' && sarPool.length ? sarPool : undefined,
      });
    }

    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  if (setCode === 's12a-vstar-universe') {
    const hits = buildVstarUniverseBoxHits(ctx, rng, pools);
    const godPackRoll = rng();
    const godPackHits =
      godPackRoll < VSTAR_UNIVERSE_SAR_GOD_PACK_RATE ? buildVstarUniverseSarGodPackHits(pools)
      : godPackRoll < VSTAR_UNIVERSE_SAR_GOD_PACK_RATE + VSTAR_UNIVERSE_AR_GOD_PACK_RATE
        ? buildVstarUniverseArGodPackHits(pools)
        : null;

    return buildHiClassPacksFromHitsWithGodPack(ctx, rng, boxSize, packSize, hits, godPackHits);
  }

  const hits: HiClassHitSlot[] = [];
  const godPackHits = rng() < HI_CLASS_GOD_PACK_RATE && hasRarity(byRarity, 'MA')
    ? buildMegaDreamGodPackHits(pools)
    : null;

  for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
  if (hasRarity(byRarity, 'AR')) hits.push({ rarity: 'AR' }, { rarity: 'AR' }, { rarity: 'AR' });

  const fixedSrPool = getMegaFixedSrPool(setCode, pools.srAll);
  if (fixedSrPool.length) hits.push({ rarity: 'SR', pool: fixedSrPool });

  if (hasRarity(byRarity, 'MA')) hits.push({ rarity: 'MA' });

  const extraRarity = ctx.weightedPick(MEGA_DREAM_EXTRA_SLOT_WEIGHTS);
  if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
    const mainSrPool = getMegaMainSrPool(setCode, pools.srAll);
    const pokemonPool =
      extraRarity === 'SR' ? mainSrPool
      : extraRarity === 'SAR' ? pools.sarAll
      : extraRarity === 'UR' ? (pools.urPokemon.length ? pools.urPokemon : pools.urAll)
      : (byRarity[extraRarity] ?? []);
    if (pokemonPool.length) hits.push({ rarity: extraRarity, pool: pokemonPool });
  }

  return buildHiClassPacksFromHitsWithGodPack(ctx, rng, boxSize, packSize, hits, godPackHits);
}

export function simulateSingleHiClassPack(
  ctx: BuildContext,
  rng: RNG,
  setCode: string | undefined,
  packSize: number,
): PackResult {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);

  if (setCode === 'sv8a-terastal-festa') {
    const pokemonSar = pools.sarAll.filter((card) => card.card_type === '포켓몬');
    const trainerSar = pools.sarAll.filter((card) => card.card_type === '트레이너' || card.card_type === '에너지');
    const hits: HiClassHitSlot[] = [];

    if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && pools.sarAll.length) {
      hits.push({ rarity: 'SAR', pool: pokemonSar.length ? pokemonSar : pools.sarAll });
    }

    const extraRarity = pickBoxSlotForSinglePack(ctx, TERASTAL_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({
        rarity: extraRarity,
        pool: extraRarity === 'SAR' && trainerSar.length ? trainerSar : undefined,
      });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
  }

  if (setCode === 'sv4a-shiny-treasure-ex') {
    const sarPool = pools.sarAll;
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && ssrPool.length) {
      hits.push({ rarity: 'SSR', pool: ssrPool });
    }

    const extraRarity = pickBoxSlotForSinglePack(ctx, SHINY_TREASURE_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({
        rarity: extraRarity,
        pool: extraRarity === 'SAR' && sarPool.length ? sarPool : undefined,
      });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
  }

  if (setCode === 's12a-vstar-universe') {
    const godPackRoll = rng();
    const sarGodPackRate = VSTAR_UNIVERSE_SAR_GOD_PACK_RATE / HI_CLASS_BOX_SIZE;
    const arGodPackRate = VSTAR_UNIVERSE_AR_GOD_PACK_RATE / HI_CLASS_BOX_SIZE;
    if (godPackRoll < sarGodPackRate) {
      return buildHiClassPack(ctx, buildVstarUniverseSarGodPackHits(pools), packSize, { defaultHitRarity: null });
    }
    if (godPackRoll < sarGodPackRate + arGodPackRate && pools.arPool.length) {
      return buildHiClassPack(ctx, buildVstarUniverseArGodPackHits(pools), packSize, { defaultHitRarity: null });
    }

    const hits: HiClassHitSlot[] = [];
    if (rng() < 5.5 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 3.5 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RRR')) hits.push({ rarity: 'RRR' });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'K')) hits.push({ rarity: 'K' });
    if (rng() < 3 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'AR')) hits.push({ rarity: 'AR' });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && pools.sarPokemon.length) {
      hits.push({ rarity: 'SAR', pool: pools.sarPokemon });
    }
    if (rng() < 1 / HI_CLASS_BOX_SIZE && pools.srEnergy.length) {
      hits.push({ rarity: 'SR', pool: pools.srEnergy });
    }

    const extraRarity = pickBoxSlotForSinglePack(ctx, VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      const pool =
        extraRarity === 'SAR' ? (pools.sarTrainer.length ? pools.sarTrainer : pools.sarAll)
        : extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
        : extraRarity === 'UR' ? pools.urAll
        : (byRarity[extraRarity] ?? []);
      if (pool.length) hits.push({ rarity: extraRarity, pool });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
  }

  if (rng() < HI_CLASS_GOD_PACK_RATE / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'MA')) {
    return buildHiClassPack(ctx, buildMegaDreamGodPackHits(pools), packSize, { defaultHitRarity: null });
  }

  const fixedSrPool = getMegaFixedSrPool(setCode, pools.srAll);
  const mainSrPool = getMegaMainSrPool(setCode, pools.srAll);
  const hits: HiClassHitSlot[] = [];

  if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
  if (rng() < 3 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'AR')) hits.push({ rarity: 'AR' });
  if (rng() < 1 / HI_CLASS_BOX_SIZE && fixedSrPool.length) hits.push({ rarity: 'SR', pool: fixedSrPool });
  if (rng() < 1 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'MA')) hits.push({ rarity: 'MA' });

  const extraRarity = pickBoxSlotForSinglePack(ctx, MEGA_DREAM_EXTRA_SLOT_WEIGHTS);
  if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
    const pool =
      extraRarity === 'SR' ? mainSrPool
      : extraRarity === 'SAR' ? pools.sarAll
      : extraRarity === 'UR' ? (pools.urPokemon.length ? pools.urPokemon : pools.urAll)
      : (byRarity[extraRarity] ?? []);
    if (pool.length) hits.push({ rarity: extraRarity, pool });
  }

  return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
}

function pickBoxSlotForSinglePack(ctx: BuildContext, boxWeights: Record<string, number>): string {
  const total = Object.values(boxWeights).reduce((sum, weight) => sum + weight, 0);
  const noneWeight = total * (HI_CLASS_BOX_SIZE - 1) + (boxWeights.NONE ?? 0);
  const packWeights: Record<string, number> = { NONE: noneWeight };

  for (const [rarity, weight] of Object.entries(boxWeights)) {
    if (rarity !== 'NONE') packWeights[rarity] = weight;
  }

  return ctx.weightedPick(packWeights);
}

function buildMegaDreamGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const godPackSarPool = pools.sarPokemon.length ? pools.sarPokemon : pools.sarAll;
  const hits: HiClassHitSlot[] = [{ rarity: 'AR' }];
  for (let i = 0; i < 5; i++) hits.push({ rarity: 'MA' });
  for (let i = 0; i < 4; i++) hits.push({ rarity: 'SAR', pool: godPackSarPool });
  return hits;
}

function buildVstarUniverseBoxHits(
  ctx: BuildContext,
  rng: RNG,
  pools: ReturnType<typeof getRarityPools>,
): HiClassHitSlot[] {
  const hits: HiClassHitSlot[] = [];
  for (let i = 0; i < 5; i++) hits.push({ rarity: 'RR' });
  if (rng() < 0.5) hits.push({ rarity: 'RR' });
  for (let i = 0; i < 3; i++) hits.push({ rarity: 'RRR' });
  if (rng() < 0.5) hits.push({ rarity: 'RRR' });
  if (pools.kAll.length) hits.push({ rarity: 'K', pool: pools.kAll });
  for (let i = 0; i < 3; i++) hits.push({ rarity: 'AR', pool: pools.arPool });
  if (pools.sarPokemon.length) hits.push({ rarity: 'SAR', pool: pools.sarPokemon });
  if (pools.srEnergy.length) hits.push({ rarity: 'SR', pool: pools.srEnergy });

  const extraRarity = ctx.weightedPick(VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS);
  const extraPool =
    extraRarity === 'SAR' ? (pools.sarTrainer.length ? pools.sarTrainer : pools.sarAll)
    : extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
    : extraRarity === 'UR' ? pools.urAll
    : [];

  if (extraPool.length) hits.push({ rarity: extraRarity, pool: extraPool });
  return hits;
}

function buildVstarUniverseArGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const hits: HiClassHitSlot[] = [];
  const arPool = pools.arPool.length ? pools.arPool : pools.sarPokemon;
  for (let i = 0; i < 9; i++) hits.push({ rarity: 'AR', pool: arPool });
  return hits;
}

function buildVstarUniverseSarGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const pokemonSarPool = pools.sarPokemon.length ? pools.sarPokemon : pools.sarAll;
  const supporterSarPool = pools.sarTrainer.length ? pools.sarTrainer : pools.sarAll;
  const arPool = pools.arPool.length ? pools.arPool : pokemonSarPool;
  const hits: HiClassHitSlot[] = [];

  for (let i = 0; i < 5; i++) hits.push({ rarity: 'AR', pool: arPool });
  for (let i = 0; i < 4; i++) hits.push({ rarity: 'SAR', pool: pokemonSarPool });
  hits.push({ rarity: 'SAR', pool: supporterSarPool });
  return hits;
}

function buildHiClassPacksFromHitsWithGodPack(
  ctx: BuildContext,
  rng: RNG,
  boxSize: number,
  packSize: number,
  hits: HiClassHitSlot[],
  godPackHits: HiClassHitSlot[] | null,
): PackResult[] {
  if (!godPackHits) return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);

  const packHits: HiClassHitSlot[][] = Array.from({ length: boxSize }, () => []);
  const godPackIndex = Math.floor(rng() * boxSize);
  const availablePackIndexes = Array.from({ length: boxSize }, (_, index) => index)
    .filter((index) => index !== godPackIndex);

  packHits[godPackIndex] = godPackHits;
  shuffle(hits, rng).forEach((hit, index) => {
    const packIndex = availablePackIndexes[index] ?? availablePackIndexes[Math.floor(rng() * availablePackIndexes.length)];
    packHits[packIndex].push(hit);
  });

  return shuffle(packHits, rng).map((slots) => buildHiClassPack(ctx, slots, packSize));
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
