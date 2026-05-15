import type { Card, SetMeta } from './types';

export const DISPLAY_RARITY_ORDER = ['MUR', 'BWR', 'SAR', 'UR', 'MA', 'SSR', 'SR', 'ACE', 'AR', 'RR', 'R', 'U', 'C'];
export const RARITY_ORDER = ['BWR', 'SAR', 'UR', 'MA', 'SSR', 'SR', 'ACE', 'AR', 'RR', 'R', 'U', 'C'];
export const FILTER_RARITY_ORDER = ['BWR', 'SAR', 'UR', 'MA', 'SSR', 'SR', 'ACE', 'AR', 'RR'];
export const HIT_RARITY_ORDER = ['BWR', 'SAR', 'UR', 'MA', 'SSR', 'SR', 'ACE', 'AR'] as const;

export const RARITY_BADGE: Record<string, string> = {
  C: 'bg-gray-500 text-white',
  U: 'bg-blue-500 text-white',
  R: 'bg-purple-500 text-white',
  RR: 'bg-amber-400 text-gray-900',
  ACE: 'bg-lime-300 text-gray-900',
  AR: 'bg-cyan-400 text-gray-900',
  SR: 'bg-orange-400 text-gray-900',
  SSR: 'bg-gradient-to-r from-violet-400 to-fuchsia-400 text-gray-900',
  SAR: 'bg-pink-400 text-gray-900',
  MA: 'bg-fuchsia-400 text-gray-900',
  MUR: 'bg-yellow-300 text-gray-900',
  UR: 'bg-yellow-300 text-gray-900',
  BWR: 'bg-gradient-to-r from-gray-100 to-white text-gray-900',
};

export const CARD_GLOW: Record<string, string> = {
  RR: 'ring-2 ring-amber-400/60',
  ACE: 'ring-2 ring-lime-300/80 shadow-md shadow-lime-400/30',
  AR: 'ring-2 ring-cyan-400/70',
  SR: 'ring-2 ring-orange-400/80 shadow-md shadow-orange-500/30',
  SSR: 'ring-[3px] ring-violet-400 shadow-lg shadow-fuchsia-500/50',
  SAR: 'ring-[3px] ring-pink-400 shadow-lg shadow-pink-500/50',
  MA: 'ring-[3px] ring-fuchsia-400 shadow-lg shadow-fuchsia-500/50',
  UR: 'ring-[3px] ring-yellow-300 shadow-xl shadow-yellow-400/60',
  BWR: 'ring-[3px] ring-white shadow-xl shadow-white/40',
};

export const RARITY_TEXT_COLOR: Record<string, string> = {
  MUR: 'text-yellow-300',
  BWR: 'text-slate-100',
  SAR: 'text-pink-300',
  UR: 'text-yellow-300',
  MA: 'text-fuchsia-300',
  SSR: 'text-violet-300',
  SR: 'text-orange-300',
  ACE: 'text-lime-300',
  AR: 'text-cyan-300',
};

export const RARITY_TIER: Record<string, string> = {
  C: 'text-gray-400',
  U: 'text-blue-400',
  R: 'text-purple-400',
  RR: 'text-amber-300',
  ACE: 'text-lime-300',
  AR: 'text-cyan-300',
  SR: 'text-orange-300',
  SSR: 'text-violet-300',
  SAR: 'text-pink-300',
  MA: 'text-fuchsia-300',
  MUR: 'text-yellow-300',
  UR: 'text-yellow-300',
  BWR: 'text-slate-100',
};

export const RARITY_FULL_LABEL: Record<string, string> = {
  C: '커먼',
  U: '언커먼',
  R: '레어',
  RR: '더블레어',
  ACE: 'ACE SPEC',
  AR: '아트레어',
  SR: '슈퍼레어',
  SSR: '샤이니 슈퍼레어',
  SAR: '스페셜아트레어',
  MA: '마스터 아트',
  MUR: '메가 울트라레어',
  UR: '울트라레어',
  BWR: '블랙 화이트 레어',
};

export const RARE_RARITIES = new Set(['RR', 'ACE', 'AR', 'SR', 'SSR', 'SAR', 'MA', 'UR', 'BWR']);
export const HIT_RARITIES = new Set(['SR', 'SSR', 'SAR', 'MA', 'UR', 'BWR', 'ACE']);
export const HOLO_RARITIES = new Set(['RR', 'ACE', 'AR', 'SR', 'SSR', 'SAR', 'MA', 'UR', 'BWR']);

type RarityContext =
  | Partial<Pick<Card, 'card_num' | 'image_url'>>
  | Pick<SetMeta, 'code'>
  | string
  | null
  | undefined;

export function isMegaContext(context?: RarityContext): boolean {
  if (!context) return false;

  if (typeof context === 'string') {
    return context.startsWith('m-') || /^m\d+-/.test(context) || context.includes('/MEGA/');
  }

  if ('code' in context) {
    return isMegaContext(context.code);
  }

  return Boolean(
    context.image_url?.startsWith('wmimages/MEGA/') ||
      context.image_url?.startsWith('external/m-') ||
      (context.card_num && /^BS20250(10|14|15)/.test(context.card_num)) ||
      (context.card_num && /^BS202600[23]/.test(context.card_num)),
  );
}

export function rarityLabel(rarity: string, context?: RarityContext): string {
  if (rarity === 'UR' && isMegaContext(context)) {
    return 'MUR';
  }

  return rarity;
}

export function rarityFullLabel(rarity: string, context?: RarityContext): string {
  return RARITY_FULL_LABEL[rarityLabel(rarity, context)] ?? rarity;
}

export function raritySortRank(rarity: string | null, context?: RarityContext): number {
  if (!rarity) return 99;

  const displayRarity = rarityLabel(rarity, context);
  const displayIndex = DISPLAY_RARITY_ORDER.indexOf(displayRarity);
  if (displayIndex !== -1) return displayIndex;

  const rawIndex = DISPLAY_RARITY_ORDER.indexOf(rarity);
  return rawIndex === -1 ? 99 : rawIndex;
}

export function sortRarityKeys(rarities: string[], context?: RarityContext): string[] {
  return [...rarities].sort((a, b) => raritySortRank(a, context) - raritySortRank(b, context));
}

export function sortByRarity<T extends { rarity: string | null; card_num?: string; image_url?: string }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => raritySortRank(a.rarity, a) - raritySortRank(b.rarity, b));
}

export function getRarityCounts(cards: Array<{ rarity: string | null }>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const card of cards) {
    if (card.rarity) {
      counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    }
  }

  return counts;
}

export function getHitCounts(cards: Card[]): Array<{ rarity: string; count: number; sample?: Card }> {
  const counts = new Map<string, { rarity: string; count: number; sample?: Card }>();

  for (const card of cards) {
    if (!card.rarity || !HIT_RARITIES.has(card.rarity)) continue;

    const displayRarity = rarityLabel(card.rarity, card);
    const current = counts.get(displayRarity);
    if (current) {
      current.count += 1;
    } else {
      counts.set(displayRarity, { rarity: displayRarity, count: 1, sample: card });
    }
  }

  return Array.from(counts.values()).sort(
    (a, b) => raritySortRank(a.rarity, a.sample) - raritySortRank(b.rarity, b.sample),
  );
}
