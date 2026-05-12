import seedrandom from 'seedrandom';
import type { Card, PackResult, BoxResult } from './types';
import { expansionPackHitPool, simulateExpansionBox } from './simulation/expansion';
import { buildExpansionPack } from './simulation/pack-builders';
import { buildSingleHiClassPack, hiClassPackHitPool, simulateHiClassBox } from './simulation/hi-class';
import { PROBABILITY_META } from './simulation/model';
import { groupByRarity } from './simulation/pools';
import { makePick, makeWeightedPick } from './simulation/random';
import type { BuildContext } from './simulation/types';

export { PROBABILITY_META, groupByRarity };

function createSimulationContext(allCards: Card[], seedInput?: string): {
  seed: string;
  ctx: BuildContext;
  rng: seedrandom.PRNG;
} {
  const seed = seedInput ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rng = seedrandom(seed);
  const byRarity = groupByRarity(allCards);
  const ctx: BuildContext = {
    byRarity,
    pick: makePick(rng),
    weightedPick: makeWeightedPick(rng),
  };

  return { seed, ctx, rng };
}

export function simulatePack(
  allCards: Card[],
  type: string,
  packSize: number,
  seedInput?: string,
  setCode?: string,
): { pack: PackResult; seed: string } {
  const { seed, ctx } = createSimulationContext(allCards, seedInput);
  const pack =
    type === 'hi-class'
      ? buildSingleHiClassPack(ctx, hiClassPackHitPool(ctx, setCode), packSize)
      : buildExpansionPack(ctx, expansionPackHitPool(ctx, setCode), packSize);

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
  const { seed, ctx, rng } = createSimulationContext(allCards, seedInput);
  const packs =
    type === 'hi-class'
      ? simulateHiClassBox(boxSize, packSize, ctx, rng, setCode)
      : simulateExpansionBox(allCards, boxSize, ctx, rng, setCode, packSize);
  const summary: Record<string, number> = {};

  for (const pack of packs) {
    for (const card of pack.cards) {
      const rarity = card.rarity ?? '?';
      summary[rarity] = (summary[rarity] ?? 0) + 1;
    }
  }

  return { packs, summary, seed };
}
