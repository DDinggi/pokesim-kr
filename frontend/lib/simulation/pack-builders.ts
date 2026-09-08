import type { Card, PackResult } from '../types';
import type { RNG } from './random';
import { shuffle } from './random';
import type { BuildContext, HiClassHitSlot } from './types';
import { resolveUniqueHitSlots } from './unique';

export function buildExpansionPack(ctx: BuildContext, hitPool: Card[], packSize = 5): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  // Most expansion packs are C/C/C/U/hit. Older all-holo products such as
  // GX Battle Boost REMASTER have no C/U entries, so use their R pool for the
  // four base slots rather than silently returning a one-card pack.
  const basePool = byRarity.C?.length ? byRarity.C : (byRarity.U?.length ? byRarity.U : (byRarity.R ?? []));
  const cPool = byRarity.C?.length ? byRarity.C : basePool;
  const uPool = byRarity.U?.length ? byRarity.U : basePool;

  for (let i = 0; i < packSize - 2; i++) {
    if (cPool.length) cards.push(pick(cPool));
  }

  if (uPool.length) cards.push(pick(uPool));

  const effectiveHitPool = hitPool.length > 0 ? hitPool : (byRarity.R ?? []);
  if (effectiveHitPool.length) cards.push(pick(effectiveHitPool));

  return { cards };
}

export function buildHiClassPack(
  ctx: BuildContext,
  hitSlots: HiClassHitSlot[],
  packSize: number,
  options: { defaultHitRarity?: string | null } = {},
): PackResult {
  const { byRarity, pick } = ctx;
  const cards: Card[] = [];
  const basePool = [
    ...(byRarity.__null__ ?? []),
    ...(byRarity.C ?? []),
    ...(byRarity.U ?? []),
    ...(byRarity.R ?? []),
  ];
  const defaultHitRarity = options.defaultHitRarity === undefined ? 'RR' : options.defaultHitRarity;
  const effectiveHitSlots = hitSlots.length > 0
    ? hitSlots
    : defaultHitRarity
      ? [{ rarity: defaultHitRarity }]
      : [];
  const baseCount = Math.max(0, packSize - effectiveHitSlots.length);

  for (let i = 0; i < baseCount; i++) {
    if (basePool.length) cards.push(pick(basePool));
  }

  for (const hit of resolveUniqueHitSlots(ctx, effectiveHitSlots)) {
    if (hit.card) {
      cards.push(hit.card);
      continue;
    }

    const hitPool = hit.pool?.length ? hit.pool : (byRarity[hit.rarity] ?? byRarity.RR ?? basePool);
    if (hitPool.length) cards.push(pick(hitPool));
  }

  return { cards };
}

export function buildHiClassPacksFromHits(
  ctx: BuildContext,
  rng: RNG,
  boxSize: number,
  packSize: number,
  hits: HiClassHitSlot[],
): PackResult[] {
  const packHits: HiClassHitSlot[][] = Array.from({ length: boxSize }, () => []);
  const shuffledHits = shuffle(resolveUniqueHitSlots(ctx, hits), rng);

  shuffledHits.forEach((hit, index) => {
    const packIndex = index < boxSize ? index : Math.floor(rng() * boxSize);
    packHits[packIndex].push(hit);
  });

  return shuffle(packHits, rng).map((slots) => buildHiClassPack(ctx, slots, packSize));
}
