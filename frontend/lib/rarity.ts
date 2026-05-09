import type { Card, SetMeta } from './types';

export const RARITY_ORDER = ['BWR', 'UR', 'SAR', 'MA', 'SR', 'AR', 'RR', 'R', 'U', 'C'];
export const FILTER_RARITY_ORDER = ['BWR', 'UR', 'SAR', 'MA', 'SR', 'AR', 'RR'];
export const HIT_RARITY_ORDER = ['BWR', 'UR', 'SAR', 'MA', 'SR', 'AR'] as const;

export const RARITY_BADGE: Record<string, string> = {
  C: 'bg-gray-500 text-white',
  U: 'bg-blue-500 text-white',
  R: 'bg-purple-500 text-white',
  RR: 'bg-amber-400 text-gray-900',
  AR: 'bg-cyan-400 text-gray-900',
  SR: 'bg-orange-400 text-gray-900',
  SAR: 'bg-pink-400 text-gray-900',
  MA: 'bg-fuchsia-400 text-gray-900',
  UR: 'bg-yellow-300 text-gray-900',
  BWR: 'bg-gradient-to-r from-gray-100 to-white text-gray-900',
};

export const CARD_GLOW: Record<string, string> = {
  RR: 'ring-2 ring-amber-400/60',
  AR: 'ring-2 ring-cyan-400/70',
  SR: 'ring-2 ring-orange-400/80 shadow-md shadow-orange-500/30',
  SAR: 'ring-[3px] ring-pink-400 shadow-lg shadow-pink-500/50',
  MA: 'ring-[3px] ring-fuchsia-400 shadow-lg shadow-fuchsia-500/50',
  UR: 'ring-[3px] ring-yellow-300 shadow-xl shadow-yellow-400/60',
  BWR: 'ring-[3px] ring-white shadow-xl shadow-white/40',
};

export const RARITY_TEXT_COLOR: Record<string, string> = {
  BWR: 'text-slate-100',
  UR: 'text-yellow-300',
  MA: 'text-fuchsia-300',
  SAR: 'text-pink-300',
  SR: 'text-orange-300',
  AR: 'text-cyan-300',
};

export const RARITY_TIER: Record<string, string> = {
  C: 'text-gray-400',
  U: 'text-blue-400',
  R: 'text-purple-400',
  RR: 'text-amber-300',
  AR: 'text-cyan-300',
  SR: 'text-orange-300',
  SAR: 'text-pink-300',
  MA: 'text-fuchsia-300',
  UR: 'text-yellow-300',
  BWR: 'text-slate-100',
};

export const RARITY_FULL_LABEL: Record<string, string> = {
  C: '커먼',
  U: '언커먼',
  R: '레어',
  RR: '더블 레어',
  AR: '아트 레어',
  SR: '슈퍼 레어',
  SAR: '스페셜 아트 레어',
  MA: '마스터 아트',
  UR: '울트라 레어',
  BWR: '블랙 화이트 레어',
};

export const RARE_RARITIES = new Set(['RR', 'AR', 'SR', 'SAR', 'MA', 'UR', 'BWR']);
export const HIT_RARITIES = new Set(['SR', 'SAR', 'MA', 'UR', 'BWR']);
export const HOLO_RARITIES = new Set(['RR', 'AR', 'SR', 'SAR', 'MA', 'UR', 'BWR']);

type RarityContext =
  | Pick<Card, 'card_num' | 'image_url'>
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

  return (
    context.image_url.startsWith('wmimages/MEGA/') ||
    context.image_url.startsWith('external/m-') ||
    /^BS20250(10|14|15)/.test(context.card_num) ||
    /^BS202600[23]/.test(context.card_num)
  );
}

export function rarityLabel(rarity: string, context?: RarityContext): string {
  if (rarity === 'UR' && isMegaContext(context)) {
    return 'MUR';
  }

  return rarity;
}

export function rarityFullLabel(rarity: string, context?: RarityContext): string {
  if (rarity === 'UR' && isMegaContext(context)) {
    return '메가 울트라 레어';
  }

  return RARITY_FULL_LABEL[rarity] ?? rarity;
}

export function sortByRarity<T extends { rarity: string | null }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    const ai = RARITY_ORDER.indexOf(a.rarity ?? '');
    const bi = RARITY_ORDER.indexOf(b.rarity ?? '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
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
  const counts = getRarityCounts(cards);

  return HIT_RARITY_ORDER
    .filter((rarity) => (counts[rarity] ?? 0) > 0)
    .map((rarity) => ({
      rarity,
      count: counts[rarity],
      sample: cards.find((card) => card.rarity === rarity),
    }));
}
