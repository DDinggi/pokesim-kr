import type { Card } from '../types';
import type { BuildContext } from './types';

export interface RarityPools {
  srAll: Card[];
  rrrAll: Card[];
  kAll: Card[];
  chrAll: Card[];
  csrAll: Card[];
  ssrAll: Card[];
  hrAll: Card[];
  sarAll: Card[];
  urAll: Card[];
  bwrAll: Card[];
  srPokemon: Card[];
  srEnergy: Card[];
  srTrainer: Card[];
  hrPokemon: Card[];
  hrTrainer: Card[];
  csrPokemon: Card[];
  ssrPokemon: Card[];
  sarPokemon: Card[];
  sarTrainer: Card[];
  urPokemon: Card[];
  bwrPokemon: Card[];
  arPool: Card[];
}

export function groupByRarity(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {};

  for (const card of cards) {
    const rarity = card.rarity ?? '__null__';
    (groups[rarity] ??= []).push(card);
  }

  return groups;
}

export function isPokemonCard(card: Card): boolean {
  return card.card_type === '포켓몬';
}

export function isTrainerLikeCard(card: Card): boolean {
  return card.card_type === '트레이너' || card.card_type === '에너지';
}

export function getRarityPools(byRarity: Record<string, Card[]>): RarityPools {
  const srAll = byRarity.SR ?? [];
  const rrrAll = byRarity.RRR ?? [];
  const kAll = byRarity.K ?? [];
  const chrAll = byRarity.CHR ?? [];
  const csrAll = byRarity.CSR ?? [];
  const ssrAll = byRarity.SSR ?? [];
  const hrAll = byRarity.HR ?? [];
  const sarAll = byRarity.SAR ?? [];
  const urAll = byRarity.UR ?? [];
  const bwrAll = byRarity.BWR ?? [];

  return {
    srAll,
    rrrAll,
    kAll,
    chrAll,
    csrAll,
    ssrAll,
    hrAll,
    sarAll,
    urAll,
    bwrAll,
    srPokemon: srAll.filter(isPokemonCard),
    srEnergy: srAll.filter((card) => card.card_type === '에너지'),
    srTrainer: srAll.filter(isTrainerLikeCard),
    hrPokemon: hrAll.filter(isPokemonCard),
    hrTrainer: hrAll.filter(isTrainerLikeCard),
    csrPokemon: csrAll.filter(isPokemonCard),
    ssrPokemon: ssrAll.filter(isPokemonCard),
    sarPokemon: sarAll.filter(isPokemonCard),
    sarTrainer: sarAll.filter(isTrainerLikeCard),
    urPokemon: urAll.filter(isPokemonCard),
    bwrPokemon: bwrAll.filter(isPokemonCard),
    arPool: byRarity.AR ?? [],
  };
}

export function hasRarity(byRarity: Record<string, Card[]>, rarity: string): boolean {
  return (byRarity[rarity]?.length ?? 0) > 0;
}

export function filterAvailableWeights(
  weights: Record<string, number>,
  byRarity: Record<string, Card[]>,
): Record<string, number> {
  const filtered: Record<string, number> = {};

  for (const [rarity, weight] of Object.entries(weights)) {
    if ((byRarity[rarity]?.length ?? 0) > 0) filtered[rarity] = weight;
  }

  return Object.keys(filtered).length > 0 ? filtered : weights;
}

export function pickWeightedPool(
  ctx: BuildContext,
  weights: Partial<Record<string, number>>,
  pools: Record<string, Card[]>,
  fallback: Card[],
): Card[] {
  const availableWeights: Record<string, number> = {};

  for (const [rarity, weight] of Object.entries(weights)) {
    if (weight && (pools[rarity]?.length ?? 0) > 0) availableWeights[rarity] = weight;
  }

  if (Object.keys(availableWeights).length === 0) return fallback;
  return pools[ctx.weightedPick(availableWeights)] ?? fallback;
}

export function pickWeightedHitPool(
  ctx: BuildContext,
  entries: { weight: number; pool: Card[] }[],
  fallback: Card[],
): Card[] {
  const weights: Record<string, number> = {};
  const pools: Record<string, Card[]> = {};

  entries.forEach((entry, index) => {
    if (entry.weight <= 0 || entry.pool.length === 0) return;
    const key = String(index);
    weights[key] = entry.weight;
    pools[key] = entry.pool;
  });

  if (Object.keys(weights).length === 0) return fallback;
  return pools[ctx.weightedPick(weights)] ?? fallback;
}

export function addFillerPackEntries(
  entries: { weight: number; pool: Card[] }[],
  byRarity: Record<string, Card[]>,
  fillerSlots: number,
  fillerWeights: Record<string, number>,
) {
  const total = Object.values(fillerWeights).reduce((a, b) => a + b, 0);

  for (const [rarity, weight] of Object.entries(fillerWeights)) {
    entries.push({ weight: (fillerSlots * weight * 100) / total, pool: byRarity[rarity] ?? [] });
  }
}
