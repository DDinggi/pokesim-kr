import type { Card, PackResult } from '../types';
import type { BuildContext } from './types';
import type { RNG } from './random';
import { shuffle } from './random';
import { POKEKYUN_BOX_RR_COUNTS, POKEKYUN_BOX_SIZE, POKEKYUN_RR_PER_PACK } from './model';

/** KR has one more C slot than JP (5 vs 4 cards); RR still uses one pack slot. */
function buildPokekyunPack(ctx: BuildContext, rr: Card | null, packSize: number): PackResult {
  const common = ctx.byRarity.C ?? [], uncommon = ctx.byRarity.U ?? [];
  if (!common.length || !uncommon.length) throw new Error('Pokekyun C/U pools are incomplete');
  const cards: Card[] = [];
  const add = (pool: Card[]) => {
    const unused = pool.filter(card => !cards.some(previous => previous.card_num === card.card_num));
    cards.push(ctx.pick(unused.length ? unused : pool));
  };
  for (let i = 0; i < Math.max(0, packSize - 2); i++) add(common);
  add(uncommon);
  if (rr) cards.push(rr); else add(uncommon);
  return { cards };
}

export function buildSinglePokekyunPack(ctx: BuildContext, rng: RNG, packSize = 5): PackResult {
  const rrPool = ctx.byRarity.RR ?? [];
  if (rrPool.length !== 7) throw new Error('Pokekyun requires all seven RR cards');
  return buildPokekyunPack(ctx, rng() < POKEKYUN_RR_PER_PACK ? ctx.pick(rrPool) : null, packSize);
}

export function simulatePokekyunBox(ctx: BuildContext, rng: RNG, boxSize: number, packSize: number): PackResult[] {
  if (boxSize !== POKEKYUN_BOX_SIZE) return Array.from({ length: boxSize }, () => buildSinglePokekyunPack(ctx, rng, packSize));
  const rrPool = ctx.byRarity.RR ?? [];
  if (rrPool.length !== 7) throw new Error('Pokekyun requires all seven RR cards');
  const count = POKEKYUN_BOX_RR_COUNTS[Math.floor(rng() * POKEKYUN_BOX_RR_COUNTS.length)];
  // Reviewed complete RR lists have no duplicates. Nonreplacement is a collation
  // approximation; individual cards remain uniform, with no Pikachu guarantee.
  const hits: Array<Card | null> = shuffle(rrPool, rng).slice(0, count);
  while (hits.length < boxSize) hits.push(null);
  return shuffle(hits, rng).map(card => buildPokekyunPack(ctx, card, packSize));
}
