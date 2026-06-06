import type { Card, SetMeta } from './types';
import {
  ALT_SR_NUMBER_RANGES,
  isAnniversary25Set,
  isMegaExpansionSet,
  isStarterSet,
} from './simulation/model';

export const SESSION_STORAGE_KEY = 'pokesim-kr-session-v1';

export type OpeningUnit = 'box' | 'pack';
export type OpeningSource = 'box-simulator' | 'vending-machine';

export interface OpeningEvent {
  id: string;
  createdAt: string;
  setCode: string;
  unit: OpeningUnit;
  source: OpeningSource;
  boxCount: number;
  packCount: number;
  cardCount: number;
  krw: number;
  rarityCounts: Record<string, number>;
  hitCards?: Card[];
}

export interface OpeningSession {
  boxes: number;
  packs: number;
  cost: number;
  cards: Card[];
  openingEvents: OpeningEvent[];
}

export const EMPTY_OPENING_SESSION: OpeningSession = {
  boxes: 0,
  packs: 0,
  cost: 0,
  cards: [],
  openingEvents: [],
};

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeOpeningSession(value: unknown): OpeningSession {
  if (!value || typeof value !== 'object') return EMPTY_OPENING_SESSION;

  const record = value as Partial<OpeningSession>;
  return {
    boxes: Number(record.boxes) || 0,
    packs: Number(record.packs) || 0,
    cost: Number(record.cost) || 0,
    cards: Array.isArray(record.cards) ? record.cards : [],
    openingEvents: Array.isArray(record.openingEvents) ? record.openingEvents : [],
  };
}

function isInRanges(number: number, ranges: Array<[number, number]> | undefined): boolean {
  return Boolean(ranges?.some(([start, end]) => number >= start && number <= end));
}

function isLowScoreUrSet(setCode?: string): boolean {
  return Boolean(
    setCode
      && !isStarterSet(setCode)
      && !isMegaExpansionSet(setCode)
      && !isAnniversary25Set(setCode),
  );
}

function openingCountKeyForCard(card: Card, setCode?: string): string {
  if (
    isLowScoreUrSet(setCode)
    && card.rarity === 'UR'
    && card.card_type !== '포켓몬'
  ) {
    return 'UR_LOW';
  }
  if (
    card.rarity === 'SR'
    && card.card_type === '포켓몬'
    && setCode
    && isInRanges(card.number, ALT_SR_NUMBER_RANGES[setCode])
  ) {
    return 'SR_ALT';
  }
  return card.rarity ?? 'UNKNOWN';
}

export function countRarities(cards: Card[], setCode?: string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const card of cards) {
    const rarity = openingCountKeyForCard(card, setCode);
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }

  return counts;
}

const OPENING_HIT_RARITIES = new Set(['BWR', 'SAR', 'UR', 'HR', 'MA', 'SSR', 'SR', '25TH', 'S8AP']);

export function getOpeningHitCards(cards: Card[], setMeta?: Pick<SetMeta, 'type'>): Card[] {
  if (setMeta?.type === 'starter') return cards;

  return cards.filter((card) => card.rarity && OPENING_HIT_RARITIES.has(card.rarity));
}

export function createOpeningEvent({
  setMeta,
  unit,
  source,
  cards,
  boxCount,
  packCount,
  krw,
}: {
  setMeta: Pick<SetMeta, 'code' | 'type'>;
  unit: OpeningUnit;
  source: OpeningSource;
  cards: Card[];
  boxCount: number;
  packCount: number;
  krw: number;
}): OpeningEvent {
  return {
    id: createEventId(),
    createdAt: new Date().toISOString(),
    setCode: setMeta.code,
    unit,
    source,
    boxCount,
    packCount,
    cardCount: cards.length,
    krw,
    rarityCounts: countRarities(cards, setMeta.code),
    hitCards: getOpeningHitCards(cards, setMeta),
  };
}
