import type { Card, SetMeta } from './types';
import {
  PREMIUM_HIT_PRICE_THRESHOLD_KRW,
  premiumSparkleVariant,
  rarityLabel,
  raritySortRank,
} from './rarity';
import { getCardReferenceValueKrw } from './valueLuck';

export const HIT_DEX_STORAGE_KEY = 'pokesim-kr-hit-dex-v1';
export const HIT_DEX_DEBUG_STORAGE_KEY = 'pokesim-kr-hit-dex-debug-v1';

const HIT_DEX_VERSION = 1;
const ALWAYS_DEX_DISPLAY_RARITIES = new Set(['SAR', 'MUR', 'BWR', 'CSR', 'MA', 'GRA', 'S8AP']);

export interface HitDexEntry {
  key: string;
  setCode: string;
  setNameKo: string;
  cardNum: string;
  firstPulledAt: string;
  lastPulledAt: string;
  pullCount: number;
  bestPriceRefKrw: number;
  card: Card;
}

export interface HitDexState {
  version: number;
  updatedAt: string | null;
  entries: HitDexEntry[];
}

export interface HitDexSetCount {
  setCode: string;
  setNameKo: string;
  uniqueCount: number;
  totalPullCount: number;
}

export interface HitDexStats {
  uniqueCount: number;
  totalPullCount: number;
  duplicatePullCount: number;
  bestEntry: HitDexEntry | null;
  setCounts: HitDexSetCount[];
}

export const EMPTY_HIT_DEX_STATE: HitDexState = {
  version: HIT_DEX_VERSION,
  updatedAt: null,
  entries: [],
};

function activeHitDexStorageKey(): string {
  if (typeof window === 'undefined') return HIT_DEX_STORAGE_KEY;

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isFullDebug = new URLSearchParams(window.location.search).get('debugHitDex') === 'full';
  return isLocalhost && isFullDebug ? HIT_DEX_DEBUG_STORAGE_KEY : HIT_DEX_STORAGE_KEY;
}

function isCardLike(value: unknown): value is Card {
  return Boolean(
    value
      && typeof value === 'object'
      && typeof (value as Partial<Card>).card_num === 'string',
  );
}

export function getHitDexCardKey(card: Card, setCode: string): string {
  return `${setCode}:${card.card_num || card.number || card.name_ko || 'unknown'}`;
}

function normalizeHitDexEntry(value: unknown): HitDexEntry | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as Partial<HitDexEntry>;
  if (!isCardLike(record.card) || typeof record.setCode !== 'string') return null;

  const key = typeof record.key === 'string' ? record.key : getHitDexCardKey(record.card, record.setCode);
  const now = new Date().toISOString();
  const bestPrice = Number(record.bestPriceRefKrw);

  return {
    key,
    setCode: record.setCode,
    setNameKo: typeof record.setNameKo === 'string' ? record.setNameKo : record.setCode,
    cardNum: typeof record.cardNum === 'string' ? record.cardNum : record.card.card_num,
    firstPulledAt: typeof record.firstPulledAt === 'string' ? record.firstPulledAt : now,
    lastPulledAt: typeof record.lastPulledAt === 'string' ? record.lastPulledAt : now,
    pullCount: Math.max(1, Number(record.pullCount) || 1),
    bestPriceRefKrw: Number.isFinite(bestPrice) && bestPrice > 0 ? bestPrice : 0,
    card: record.card,
  };
}

export function normalizeHitDexState(value: unknown): HitDexState {
  if (!value || typeof value !== 'object') return EMPTY_HIT_DEX_STATE;

  const record = value as Partial<HitDexState>;
  const rawEntries = Array.isArray(record.entries) ? record.entries : [];
  const entries = rawEntries
    .map(normalizeHitDexEntry)
    .filter((entry): entry is HitDexEntry => entry !== null);

  return {
    version: HIT_DEX_VERSION,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    entries,
  };
}

export function loadHitDex(): HitDexState {
  if (typeof window === 'undefined') return EMPTY_HIT_DEX_STATE;

  try {
    const stored = window.localStorage.getItem(activeHitDexStorageKey());
    if (!stored) return EMPTY_HIT_DEX_STATE;
    return normalizeHitDexState(JSON.parse(stored));
  } catch {
    /* corrupt localStorage - ignore */
  }

  return EMPTY_HIT_DEX_STATE;
}

export function saveHitDex(state: HitDexState): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(activeHitDexStorageKey(), JSON.stringify(state));
  } catch {
    /* quota / private mode - ignore */
  }
}

export function isHitDexCard(card: Card, setCode?: string): boolean {
  const displayRarity = card.rarity ? rarityLabel(card.rarity, card) : null;
  if (displayRarity && ALWAYS_DEX_DISPLAY_RARITIES.has(displayRarity)) return true;
  if (premiumSparkleVariant(card.rarity, card) !== null) return true;

  return getCardReferenceValueKrw(card, setCode) >= PREMIUM_HIT_PRICE_THRESHOLD_KRW;
}

function chooseStoredCard(current: HitDexEntry, nextCard: Card, setCode: string): Card {
  const currentValue = getCardReferenceValueKrw(current.card, setCode);
  const nextValue = getCardReferenceValueKrw(nextCard, setCode);

  if (!current.card.image_url && nextCard.image_url) return nextCard;
  if (nextValue > currentValue) return nextCard;
  return current.card;
}

export function addCardsToHitDex(
  cards: Card[],
  setMeta: Pick<SetMeta, 'code' | 'name_ko'>,
): { state: HitDexState; changed: boolean; added: number; updated: number } {
  if (typeof window === 'undefined' || cards.length === 0) {
    return { state: EMPTY_HIT_DEX_STATE, changed: false, added: 0, updated: 0 };
  }

  const current = loadHitDex();
  const entriesByKey = new Map(current.entries.map((entry) => [entry.key, { ...entry }]));
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;

  for (const card of cards) {
    if (!isHitDexCard(card, setMeta.code)) continue;

    const key = getHitDexCardKey(card, setMeta.code);
    const value = getCardReferenceValueKrw(card, setMeta.code);
    const existing = entriesByKey.get(key);

    if (existing) {
      existing.pullCount += 1;
      existing.lastPulledAt = now;
      existing.setNameKo = setMeta.name_ko;
      existing.bestPriceRefKrw = Math.max(existing.bestPriceRefKrw, value);
      existing.card = chooseStoredCard(existing, card, setMeta.code);
      entriesByKey.set(key, existing);
      updated += 1;
      continue;
    }

    entriesByKey.set(key, {
      key,
      setCode: setMeta.code,
      setNameKo: setMeta.name_ko,
      cardNum: card.card_num,
      firstPulledAt: now,
      lastPulledAt: now,
      pullCount: 1,
      bestPriceRefKrw: value,
      card,
    });
    added += 1;
  }

  const changed = added > 0 || updated > 0;
  if (!changed) return { state: current, changed: false, added: 0, updated: 0 };

  const nextState: HitDexState = {
    version: HIT_DEX_VERSION,
    updatedAt: now,
    entries: getSortedHitDexEntries({ ...current, entries: Array.from(entriesByKey.values()) }),
  };
  saveHitDex(nextState);

  return { state: nextState, changed: true, added, updated };
}

function compareHitDexEntries(a: HitDexEntry, b: HitDexEntry): number {
  const valueDiff = b.bestPriceRefKrw - a.bestPriceRefKrw;
  if (valueDiff !== 0) return valueDiff;

  const rarityDiff = raritySortRank(a.card.rarity, a.card) - raritySortRank(b.card.rarity, b.card);
  if (rarityDiff !== 0) return rarityDiff;

  const countDiff = b.pullCount - a.pullCount;
  if (countDiff !== 0) return countDiff;

  return new Date(b.lastPulledAt).getTime() - new Date(a.lastPulledAt).getTime();
}

export function getSortedHitDexEntries(state: HitDexState): HitDexEntry[] {
  return [...state.entries].sort(compareHitDexEntries);
}

export function getHitDexStats(state: HitDexState): HitDexStats {
  const entries = getSortedHitDexEntries(state);
  const setCountsByCode = new Map<string, HitDexSetCount>();

  let totalPullCount = 0;
  for (const entry of entries) {
    totalPullCount += entry.pullCount;
    const current = setCountsByCode.get(entry.setCode) ?? {
      setCode: entry.setCode,
      setNameKo: entry.setNameKo,
      uniqueCount: 0,
      totalPullCount: 0,
    };
    current.uniqueCount += 1;
    current.totalPullCount += entry.pullCount;
    setCountsByCode.set(entry.setCode, current);
  }

  const setCounts = Array.from(setCountsByCode.values()).sort((a, b) => {
    const totalDiff = b.totalPullCount - a.totalPullCount;
    if (totalDiff !== 0) return totalDiff;
    return b.uniqueCount - a.uniqueCount;
  });

  return {
    uniqueCount: entries.length,
    totalPullCount,
    duplicatePullCount: Math.max(0, totalPullCount - entries.length),
    bestEntry: entries[0] ?? null,
    setCounts,
  };
}
