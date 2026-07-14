import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import {
  GX_ULTRA_SHINY_EXTRA_SLOT_WEIGHTS,
  GX_ULTRA_SHINY_SECOND_PR_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_MAIN_SR_NUMBER_RANGES,
  SHINY_STAR_V_EXTRA_SLOT_WEIGHTS,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  TAG_ALL_STARS_GOD_PACK_PACK_RATE,
  TAG_ALL_STARS_GOD_PACK_RATE,
  TAG_ALL_STARS_MAIN_SLOT_WEIGHTS,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
  VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE,
  VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS,
  VMAX_CLIMAX_SR_GOD_PACK_RATE,
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
import { resolveUniqueHitSlots } from './unique';

const HI_CLASS_BOX_SIZE = 10;
const VSTAR_UNIVERSE_AR9_NUMBERS = [201, 202, 203, 204, 205, 206, 207, 208, 209] as const;
const VSTAR_UNIVERSE_AR9_NUMBER_SET = new Set<number>(VSTAR_UNIVERSE_AR9_NUMBERS);

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
    const pokemonSar = pools.sarAll.filter((card) => card.card_type === '\uD3EC\uCF13\uBAAC');
    const trainerSar = pools.sarAll.filter((card) => card.card_type === '\uD2B8\uB808\uC774\uB108' || card.card_type === '\uC5D0\uB108\uC9C0');
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

  if (setCode === 's4a-shiny-star-v') {
    const sPool = byRarity.S ?? [];
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
    for (let i = 0; i < 3; i++) {
      if (sPool.length) hits.push({ rarity: 'S', pool: sPool });
    }
    if (ssrPool.length) hits.push({ rarity: 'SSR', pool: ssrPool });

    const extraRarity = ctx.weightedPick(SHINY_STAR_V_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({ rarity: extraRarity });
    }

    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  if (setCode === 'sm8b-gx-ultra-shiny') {
    const sPool = byRarity.S ?? [];
    const prPool = byRarity.PR ?? [];
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
    const extraRarity = ctx.weightedPick(GX_ULTRA_SHINY_EXTRA_SLOT_WEIGHTS);

    if (sPool.length) hits.push({ rarity: 'S', pool: sPool });
    if (extraRarity === 'NONE' && sPool.length) hits.push({ rarity: 'S', pool: sPool });
    if (prPool.length) hits.push({ rarity: 'PR', pool: prPool });
    if (rng() < GX_ULTRA_SHINY_SECOND_PR_RATE && prPool.length) {
      hits.push({ rarity: 'PR', pool: prPool });
    }
    if (ssrPool.length) hits.push({ rarity: 'SSR', pool: ssrPool });

    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      const extraPool =
        extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
        : extraRarity === 'UR' ? pools.urAll
        : (byRarity[extraRarity] ?? []);
      if (extraPool.length) hits.push({ rarity: extraRarity, pool: extraPool });
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

  if (setCode === 's8b-vmax-climax') {
    const godPackRoll = rng();
    const isSrGodPack = godPackRoll < VMAX_CLIMAX_SR_GOD_PACK_RATE;
    const isChrCsrGodPack =
      !isSrGodPack && godPackRoll < VMAX_CLIMAX_SR_GOD_PACK_RATE + VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE;
    const godPackHits =
      isSrGodPack ? buildVmaxClimaxSrGodPackHits(pools)
      : isChrCsrGodPack ? buildVmaxClimaxChrCsrGodPackHits(pools)
      : null;
    const hits = buildVmaxClimaxBoxHits(ctx, rng, pools, !godPackHits);

    return buildHiClassPacksFromHitsWithGodPack(ctx, rng, boxSize, packSize, hits, godPackHits);
  }

  if (setCode === 'sm12a-tag-team-gx-tag-all-stars') {
    const hits: HiClassHitSlot[] = [];
    const mainSrPool = pools.srAll.filter((card) => card.card_type !== '\uC5D0\uB108\uC9C0');
    const energySrPool = pools.srAll.filter((card) => card.card_type === '\uC5D0\uB108\uC9C0');
    const isGodPack = rng() < TAG_ALL_STARS_GOD_PACK_RATE;

    for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });

    if (!isGodPack) {
      const mainRarity = ctx.weightedPick(TAG_ALL_STARS_MAIN_SLOT_WEIGHTS);
      if (hasRarity(byRarity, mainRarity)) {
        hits.push({
          rarity: mainRarity,
          pool: mainRarity === 'SR' && mainSrPool.length ? mainSrPool : undefined,
        });
      }
      if (energySrPool.length) hits.push({ rarity: 'SR', pool: energySrPool });
    }

    const godPackHits = isGodPack ? buildTagAllStarsGodPackHits(pools) : null;
    return buildHiClassPacksFromHitsWithGodPack(ctx, rng, boxSize, packSize, hits, godPackHits);
  }

  const hits: HiClassHitSlot[] = [];

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

  return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
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
    const pokemonSar = pools.sarAll.filter((card) => card.card_type === '\uD3EC\uCF13\uBAAC');
    const trainerSar = pools.sarAll.filter((card) => card.card_type === '\uD2B8\uB808\uC774\uB108' || card.card_type === '\uC5D0\uB108\uC9C0');
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

  if (setCode === 's4a-shiny-star-v') {
    const sPool = byRarity.S ?? [];
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 3 / HI_CLASS_BOX_SIZE && sPool.length) hits.push({ rarity: 'S', pool: sPool });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && ssrPool.length) {
      hits.push({ rarity: 'SSR', pool: ssrPool });
    }

    const extraRarity = pickBoxSlotForSinglePack(ctx, SHINY_STAR_V_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      hits.push({ rarity: extraRarity });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
  }

  if (setCode === 'sm8b-gx-ultra-shiny') {
    const sPool = byRarity.S ?? [];
    const prPool = byRarity.PR ?? [];
    const ssrPool = pools.ssrPokemon.length ? pools.ssrPokemon : pools.ssrAll;
    const hits: HiClassHitSlot[] = [];

    if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 1.5 / HI_CLASS_BOX_SIZE && sPool.length) hits.push({ rarity: 'S', pool: sPool });
    if (rng() < 1.5 / HI_CLASS_BOX_SIZE && prPool.length) hits.push({ rarity: 'PR', pool: prPool });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && ssrPool.length) hits.push({ rarity: 'SSR', pool: ssrPool });

    const extraRarity = pickBoxSlotForSinglePack(ctx, GX_ULTRA_SHINY_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      const extraPool =
        extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
        : extraRarity === 'UR' ? pools.urAll
        : (byRarity[extraRarity] ?? []);
      if (extraPool.length) hits.push({ rarity: extraRarity, pool: extraPool });
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
    const regularArPool = getVstarUniverseRegularArPool(pools);
    if (rng() < 3 / HI_CLASS_BOX_SIZE && regularArPool.length) {
      hits.push({ rarity: 'AR', pool: regularArPool });
    }
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

  if (setCode === 's8b-vmax-climax') {
    const godPackRoll = rng();
    const srGodPackRate = VMAX_CLIMAX_SR_GOD_PACK_RATE / HI_CLASS_BOX_SIZE;
    const chrCsrGodPackRate = VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE / HI_CLASS_BOX_SIZE;
    if (godPackRoll < srGodPackRate) {
      return buildHiClassPack(ctx, buildVmaxClimaxSrGodPackHits(pools), packSize, { defaultHitRarity: null });
    }
    if (godPackRoll < srGodPackRate + chrCsrGodPackRate) {
      return buildHiClassPack(ctx, buildVmaxClimaxChrCsrGodPackHits(pools), packSize, { defaultHitRarity: null });
    }

    const hits: HiClassHitSlot[] = [];
    if (rng() < 5.5 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });
    if (rng() < 3.5 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RRR')) hits.push({ rarity: 'RRR' });
    if (rng() < 3.333 / HI_CLASS_BOX_SIZE && pools.chrAll.length) hits.push({ rarity: 'CHR', pool: pools.chrAll });
    if (rng() < 1 / HI_CLASS_BOX_SIZE && pools.csrAll.length) hits.push({ rarity: 'CSR', pool: pools.csrAll });

    const extraRarity = pickBoxSlotForSinglePack(ctx, VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS);
    if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
      const pool =
        extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
        : extraRarity === 'GRA' ? pools.graAll
        : (byRarity[extraRarity] ?? []);
      if (pool.length) hits.push({ rarity: extraRarity, pool });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
  }

  if (setCode === 'sm12a-tag-team-gx-tag-all-stars') {
    if (rng() < TAG_ALL_STARS_GOD_PACK_PACK_RATE) {
      return buildHiClassPack(ctx, buildTagAllStarsGodPackHits(pools), packSize, { defaultHitRarity: null });
    }

    const hits: HiClassHitSlot[] = [];
    const mainSrPool = pools.srAll.filter((card) => card.card_type !== '\uC5D0\uB108\uC9C0');
    const energySrPool = pools.srAll.filter((card) => card.card_type === '\uC5D0\uB108\uC9C0');

    if (rng() < 9 / HI_CLASS_BOX_SIZE && hasRarity(byRarity, 'RR')) hits.push({ rarity: 'RR' });

    const mainRarity = pickBoxSlotForSinglePack(ctx, TAG_ALL_STARS_MAIN_SLOT_WEIGHTS);
    if (mainRarity !== 'NONE' && hasRarity(byRarity, mainRarity)) {
      hits.push({
        rarity: mainRarity,
        pool: mainRarity === 'SR' && mainSrPool.length ? mainSrPool : undefined,
      });
    }
    if (rng() < 1 / HI_CLASS_BOX_SIZE && energySrPool.length) {
      hits.push({ rarity: 'SR', pool: energySrPool });
    }

    return buildHiClassPack(ctx, hits, packSize, { defaultHitRarity: null });
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

function buildTagAllStarsGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  return repeatedUniqueHits('SR', pools.srAll, 10, 'sm12a-sr10');
}

function fixedNumberHits(
  rarity: string,
  sourcePool: Card[],
  numbers: number[],
  fallbackPool: Card[],
  uniqueGroup: string,
): HiClassHitSlot[] {
  const byNumber = new Map(sourcePool.map((card) => [card.number, card]));
  const fixedCards = numbers.map((number) => byNumber.get(number)).filter((card): card is Card => Boolean(card));

  if (fixedCards.length === numbers.length) {
    return fixedCards.map((card) => ({ rarity, card, uniqueGroup }));
  }

  const pool = sourcePool.length ? sourcePool : fallbackPool;
  return repeatedUniqueHits(rarity, pool, numbers.length, uniqueGroup);
}

function repeatedUniqueHits(
  rarity: string,
  pool: Card[],
  count: number,
  uniqueGroup: string,
): HiClassHitSlot[] {
  const hits: HiClassHitSlot[] = [];
  for (let i = 0; i < count; i++) hits.push({ rarity, pool, uniqueGroup });
  return hits;
}

function buildVstarUniverseBoxHits(
  ctx: BuildContext,
  rng: RNG,
  pools: ReturnType<typeof getRarityPools>,
): HiClassHitSlot[] {
  const hits: HiClassHitSlot[] = [];
  const regularArPool = getVstarUniverseRegularArPool(pools);
  for (let i = 0; i < 5; i++) hits.push({ rarity: 'RR' });
  if (rng() < 0.5) hits.push({ rarity: 'RR' });
  for (let i = 0; i < 3; i++) hits.push({ rarity: 'RRR' });
  if (rng() < 0.5) hits.push({ rarity: 'RRR' });
  if (pools.kAll.length) hits.push({ rarity: 'K', pool: pools.kAll });
  for (let i = 0; i < 3; i++) {
    if (regularArPool.length) hits.push({ rarity: 'AR', pool: regularArPool });
  }
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

function buildVmaxClimaxBoxHits(
  ctx: BuildContext,
  rng: RNG,
  pools: ReturnType<typeof getRarityPools>,
  includeCsr: boolean,
): HiClassHitSlot[] {
  const hits: HiClassHitSlot[] = [];
  for (let i = 0; i < 5; i++) hits.push({ rarity: 'RR' });
  if (rng() < 0.5) hits.push({ rarity: 'RR' });
  for (let i = 0; i < 3; i++) hits.push({ rarity: 'RRR' });
  if (rng() < 0.5) hits.push({ rarity: 'RRR' });
  for (let i = 0; i < 3; i++) hits.push({ rarity: 'CHR', pool: pools.chrAll });
  if (rng() < 1 / 3) hits.push({ rarity: 'CHR', pool: pools.chrAll });
  if (includeCsr && pools.csrAll.length) hits.push({ rarity: 'CSR', pool: pools.csrAll });

  const extraRarity = ctx.weightedPick(VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS);
  const extraPool =
    extraRarity === 'SR' ? (pools.srTrainer.length ? pools.srTrainer : pools.srAll)
    : extraRarity === 'GRA' ? pools.graAll
    : [];

  if (extraPool.length) hits.push({ rarity: extraRarity, pool: extraPool });
  return hits;
}

function buildVmaxClimaxSrGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const gymLeaderSrNumbers = [256, 257, 261, 262, 268, 270, 271, 272, 275, 277];
  return fixedNumberHits('SR', pools.srTrainer, gymLeaderSrNumbers, pools.srAll, 's8b-sr10');
}

function buildVmaxClimaxChrCsrGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const csrVPool = pools.csrAll.filter((card) => / V(?!MAX|-UNION)/.test(card.name_ko ?? ''));
  const csrVmaxPool = pools.csrAll.filter((card) => (card.name_ko ?? '').includes('VMAX'));
  return [
    ...repeatedUniqueHits('CHR', pools.chrAll, 5, 's8b-chr-csr10-chr'),
    ...repeatedUniqueHits('CSR', csrVPool.length ? csrVPool : pools.csrAll, 3, 's8b-chr-csr10-csr-v'),
    ...repeatedUniqueHits('CSR', csrVmaxPool.length ? csrVmaxPool : pools.csrAll, 2, 's8b-chr-csr10-csr-vmax'),
  ];
}

function buildVstarUniverseArGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const ar9Pool = getVstarUniverseAr9Pool(pools);
  return fixedNumberHits(
    'AR',
    ar9Pool,
    [...VSTAR_UNIVERSE_AR9_NUMBERS],
    ar9Pool,
    's12a-ar9',
  );
}

function buildVstarUniverseSarGodPackHits(pools: ReturnType<typeof getRarityPools>): HiClassHitSlot[] {
  const pokemonSarPool = pools.sarPokemon.length ? pools.sarPokemon : pools.sarAll;
  const supporterSarPool = pools.sarTrainer.length ? pools.sarTrainer : pools.sarAll;
  const regularArPool = getVstarUniverseRegularArPool(pools);
  const arPool = regularArPool.length ? regularArPool : pokemonSarPool;

  return [
    ...repeatedUniqueHits('AR', arPool, 5, 's12a-sar10-ar'),
    ...repeatedUniqueHits('SAR', pokemonSarPool, 4, 's12a-sar10-pokemon-sar'),
    ...repeatedUniqueHits('SAR', supporterSarPool, 1, 's12a-sar10-supporter-sar'),
  ];
}

function getVstarUniverseRegularArPool(pools: ReturnType<typeof getRarityPools>): Card[] {
  return pools.arPool.filter((card) => !VSTAR_UNIVERSE_AR9_NUMBER_SET.has(card.number));
}

function getVstarUniverseAr9Pool(pools: ReturnType<typeof getRarityPools>): Card[] {
  return pools.arPool.filter((card) => VSTAR_UNIVERSE_AR9_NUMBER_SET.has(card.number));
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

  const usedCardNums = new Set<string>();
  const resolvedGodPackHits = resolveUniqueHitSlots(ctx, godPackHits, usedCardNums);
  const resolvedHits = resolveUniqueHitSlots(ctx, hits, usedCardNums);
  const packHits: HiClassHitSlot[][] = Array.from({ length: boxSize }, () => []);
  const godPackIndex = Math.floor(rng() * boxSize);
  const availablePackIndexes = Array.from({ length: boxSize }, (_, index) => index)
    .filter((index) => index !== godPackIndex);

  packHits[godPackIndex] = resolvedGodPackHits;
  shuffle(resolvedHits, rng).forEach((hit, index) => {
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
