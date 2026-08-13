import priceData from './dailyLuckPrices.generated.json';
import { isDailyLuckResultCard } from './dailyLuck';
import type { Card } from './types';

interface DailyLuckPriceSet {
  slug: string;
  sourceUrl: string;
  expectedCardValueKrw: number;
  boxPriceKrw: number;
  pricedCards: number;
  fallbackCards: number;
  pricesByNumber: Record<string, number>;
}

interface DailyLuckPriceData {
  source: {
    name: string;
    url: string;
    syncedAt: string;
    note: string;
  };
  sets: Record<string, DailyLuckPriceSet>;
}

const referencePrices = priceData as DailyLuckPriceData;
export const DAILY_LUCK_UNLISTED_CARD_CAP_KRW = 1_000;

export function hasDailyLuckReferencePrices(setCode: string): boolean {
  return Boolean(referencePrices.sets[setCode]);
}

export function getDailyLuckReferenceValueKrw(setCode: string, cards: Card[]): number {
  const setPrices = referencePrices.sets[setCode];
  if (!setPrices) return 0;
  return cards.filter(isDailyLuckResultCard).reduce((total, card) => {
    const sourcePrice = setPrices.pricesByNumber[String(card.number)];
    if (sourcePrice !== undefined) return total + sourcePrice;

    const localReferencePrice = Number(card.price_ref_krw);
    const fallbackPrice = Number.isFinite(localReferencePrice) && localReferencePrice > 0
      ? Math.min(Math.round(localReferencePrice), DAILY_LUCK_UNLISTED_CARD_CAP_KRW)
      : DAILY_LUCK_UNLISTED_CARD_CAP_KRW;
    return total + fallbackPrice;
  }, 0);
}

export function getDailyLuckReferencePriceSet(setCode: string): DailyLuckPriceSet | null {
  return referencePrices.sets[setCode] ?? null;
}

export const DAILY_LUCK_REFERENCE_PRICE_SOURCE = referencePrices.source;
