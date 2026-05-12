import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import {
  HI_CLASS_GOD_PACK_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_TRAINER_SLOT_WEIGHTS,
  TERASTAL_EXTRA_SLOT_RATE,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
} from './model';
import { buildHiClassPack, buildHiClassPacksFromHits } from './pack-builders';
import {
  filterAvailableWeights,
  getRarityPools,
  hasRarity,
  pickWeightedHitPool,
} from './pools';
import type { BuildContext, HiClassHitSlot } from './types';

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
    const godPackSarPool = pools.sarPokemon.length ? pools.sarPokemon : pools.sarAll;
    hits.push({ rarity: 'AR' });
    for (let i = 0; i < 5; i++) hits.push({ rarity: 'MA' });
    for (let i = 0; i < 4; i++) hits.push({ rarity: 'SAR', pool: godPackSarPool });
    return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
  }

  for (let i = 0; i < 9; i++) hits.push({ rarity: 'RR' });
  if (hasRarity(byRarity, 'AR')) hits.push({ rarity: 'AR' }, { rarity: 'AR' }, { rarity: 'AR' });

  const trainerPools: Record<string, Card[]> = {
    SR: pools.srTrainer,
    SAR: pools.sarTrainer,
  };
  const trainerFallback = pools.srTrainer.length
    ? pools.srTrainer
    : (pools.sarTrainer.length ? pools.sarTrainer : pools.srAll);

  if (trainerFallback.length) {
    const trainerRarity = ctx.weightedPick(filterAvailableWeights(MEGA_TRAINER_SLOT_WEIGHTS, trainerPools));
    const trainerPool = trainerPools[trainerRarity]?.length ? trainerPools[trainerRarity] : trainerFallback;
    hits.push({ rarity: trainerRarity, pool: trainerPool });
  }

  if (hasRarity(byRarity, 'MA')) hits.push({ rarity: 'MA' });

  const extraRarity = ctx.weightedPick(MEGA_DREAM_EXTRA_SLOT_WEIGHTS);
  if (extraRarity !== 'NONE' && hasRarity(byRarity, extraRarity)) {
    const pokemonPool =
      extraRarity === 'SR' ? pools.srPokemon
      : extraRarity === 'SAR' ? pools.sarPokemon
      : extraRarity === 'UR' ? (pools.urPokemon.length ? pools.urPokemon : pools.urAll)
      : (byRarity[extraRarity] ?? []);
    if (pokemonPool.length) hits.push({ rarity: extraRarity, pool: pokemonPool });
  }

  return buildHiClassPacksFromHits(ctx, rng, boxSize, packSize, hits);
}

export function hiClassPackHitPool(ctx: BuildContext, setCode?: string): Card[] {
  const { byRarity } = ctx;
  const pools = getRarityPools(byRarity);
  const entries: { weight: number; pool: Card[] }[] = [];

  if (setCode === 'sv8a-terastal-festa') {
    const extraTotal = Object.values(TERASTAL_EXTRA_SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
    entries.push({ weight: 900, pool: byRarity.RR ?? [] });
    entries.push({ weight: 100, pool: pools.sarPokemon.length ? pools.sarPokemon : pools.sarAll });
    entries.push({ weight: (TERASTAL_EXTRA_SLOT_RATE * TERASTAL_EXTRA_SLOT_WEIGHTS.SR * 100) / extraTotal, pool: pools.srAll });
    entries.push({ weight: (TERASTAL_EXTRA_SLOT_RATE * TERASTAL_EXTRA_SLOT_WEIGHTS.SAR * 100) / extraTotal, pool: pools.sarTrainer });
    entries.push({ weight: (TERASTAL_EXTRA_SLOT_RATE * TERASTAL_EXTRA_SLOT_WEIGHTS.UR * 100) / extraTotal, pool: pools.urAll });
    return pickWeightedHitPool(ctx, entries, byRarity.RR ?? []);
  }

  entries.push({ weight: 900, pool: byRarity.RR ?? [] });
  entries.push({ weight: 300, pool: byRarity.AR ?? [] });
  entries.push({ weight: 100, pool: byRarity.MA ?? [] });
  entries.push({ weight: MEGA_TRAINER_SLOT_WEIGHTS.SR, pool: pools.srTrainer });
  entries.push({ weight: MEGA_TRAINER_SLOT_WEIGHTS.SAR, pool: pools.sarTrainer });
  entries.push({ weight: MEGA_DREAM_EXTRA_SLOT_WEIGHTS.SR, pool: pools.srPokemon });
  entries.push({ weight: MEGA_DREAM_EXTRA_SLOT_WEIGHTS.SAR, pool: pools.sarPokemon });
  entries.push({ weight: MEGA_DREAM_EXTRA_SLOT_WEIGHTS.UR, pool: pools.urPokemon.length ? pools.urPokemon : pools.urAll });

  return pickWeightedHitPool(ctx, entries, byRarity.RR ?? []);
}

export function buildSingleHiClassPack(ctx: BuildContext, hitPool: Card[], packSize: number): PackResult {
  return buildHiClassPack(ctx, [{ rarity: 'hit', pool: hitPool }], packSize);
}
