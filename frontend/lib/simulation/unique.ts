import type { Card } from '../types';
import type { BuildContext, HiClassHitSlot } from './types';

export const UNIQUE_BOX_HIT_RARITIES = new Set([
  'A',
  'AR',
  'CHR',
  'CSR',
  'GRA',
  'K',
  'MA',
  'RRR',
  'S',
  'SSR',
  'TR',
]);

export function pickUniqueCard(
  ctx: BuildContext,
  pool: Card[],
  usedCardNums: Set<string>,
): Card | null {
  if (!pool.length) return null;

  const available = pool.filter((card) => !usedCardNums.has(card.card_num));
  const card = ctx.pick(available.length ? available : pool);
  usedCardNums.add(card.card_num);
  return card;
}

export function resolveUniqueHitSlots(
  ctx: BuildContext,
  hitSlots: HiClassHitSlot[],
  usedCardNums = new Set<string>(),
): HiClassHitSlot[] {
  const groupUsed = new Map<string, Set<string>>();

  return hitSlots.map((hit) => {
    const rarityUnique = UNIQUE_BOX_HIT_RARITIES.has(hit.rarity);
    const group = hit.uniqueGroup;

    if (!rarityUnique && !group) return hit;

    const used = group
      ? (groupUsed.get(group) ?? new Set<string>())
      : usedCardNums;
    if (group && !groupUsed.has(group)) groupUsed.set(group, used);

    if (hit.card) {
      used.add(hit.card.card_num);
      return hit;
    }

    const pool = hit.pool?.length ? hit.pool : (ctx.byRarity[hit.rarity] ?? []);
    const card = pickUniqueCard(ctx, pool, used);
    return card ? { ...hit, card } : hit;
  });
}