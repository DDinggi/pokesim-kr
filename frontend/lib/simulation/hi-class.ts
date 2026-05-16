import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  HI_CLASS_GOD_PACK_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_MAIN_SR_NUMBER_RANGES,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
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
