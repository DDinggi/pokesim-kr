import type { Card, SetMeta } from './types';
import {
  ALT_SR_NUMBER_RANGES,
  isAnniversary25Set,
  isMegaExpansionSet,
  isStarterSet,
} from './simulation/model';
import { getCardReferenceValueKrw } from './valueLuck';

export const SESSION_STORAGE_KEY = 'pokesim-kr-session-v1';
export const OPENING_HISTORY_USER_STORAGE_PREFIX = `${SESSION_STORAGE_KEY}:user:`;
export const OPENING_HISTORY_LOCAL_CHANGE_EVENT = 'pokesim:opening-history-change';

let activeOpeningOwnerId: string | null = null;

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

function openingStorageKey(ownerId: string | null = activeOpeningOwnerId): string {
  return ownerId
    ? `${OPENING_HISTORY_USER_STORAGE_PREFIX}${encodeURIComponent(ownerId)}`
    : SESSION_STORAGE_KEY;
}

function notifyOpeningHistoryLocalChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPENING_HISTORY_LOCAL_CHANGE_EVENT));
}

export function setActiveOpeningOwner(ownerId: string | null): void {
  activeOpeningOwnerId = ownerId;
}

export function loadOpeningSession(ownerId: string | null = activeOpeningOwnerId): OpeningSession {
  if (typeof window === 'undefined') return EMPTY_OPENING_SESSION;

  try {
    const stored = window.localStorage.getItem(openingStorageKey(ownerId));
    return stored ? normalizeOpeningSession(JSON.parse(stored)) : EMPTY_OPENING_SESSION;
  } catch {
    return EMPTY_OPENING_SESSION;
  }
}

export function saveOpeningSession(
  session: OpeningSession,
  ownerId: string | null = activeOpeningOwnerId,
  options: { notify?: boolean } = {},
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const storageKey = openingStorageKey(ownerId);
    if (session.cards.length === 0 && session.openingEvents.length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    }
    if (options.notify !== false) notifyOpeningHistoryLocalChange();
    return true;
  } catch {
    return false;
  }
}

export function getGuestOpeningSession(): OpeningSession {
  return loadOpeningSession(null);
}

export function clearGuestOpeningSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  notifyOpeningHistoryLocalChange();
}

export function clearOwnerOpeningSession(ownerId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(OPENING_HISTORY_USER_STORAGE_PREFIX + encodeURIComponent(ownerId));
  notifyOpeningHistoryLocalChange();
}

function hasAlignedEventCards(session: OpeningSession): boolean {
  const eventCardCount = session.openingEvents.reduce(
    (sum, event) => sum + Math.max(0, event.cardCount),
    0,
  );
  return eventCardCount === session.cards.length;
}

function cardsForEvents(
  session: OpeningSession,
  includeEvent: (event: OpeningEvent) => boolean,
): Card[] | null {
  if (!hasAlignedEventCards(session)) return null;

  const cards: Card[] = [];
  let offset = 0;
  for (const event of session.openingEvents) {
    const nextOffset = offset + Math.max(0, event.cardCount);
    if (includeEvent(event)) cards.push(...session.cards.slice(offset, nextOffset));
    offset = nextOffset;
  }
  return cards;
}

function openingEventTotals(events: OpeningEvent[]) {
  return {
    boxes: events.reduce((sum, event) => sum + event.boxCount, 0),
    packs: events.reduce(
      (sum, event) => sum + (event.unit === 'pack' ? event.packCount : 0),
      0,
    ),
    cost: events.reduce((sum, event) => sum + event.krw, 0),
  };
}

export function removeOpeningSet(
  session: OpeningSession,
  setCode: string,
): OpeningSession {
  const openingEvents = session.openingEvents.filter((event) => event.setCode !== setCode);
  const filteredCards = cardsForEvents(session, (event) => event.setCode !== setCode);
  return {
    boxes: openingEvents.reduce((sum, event) => sum + event.boxCount, 0),
    packs: openingEvents.reduce(
      (sum, event) => sum + (event.unit === 'pack' ? event.packCount : 0),
      0,
    ),
    cost: openingEvents.reduce((sum, event) => sum + event.krw, 0),
    // Legacy sessions did not preserve a card-to-event boundary. Keep their card
    // list intact instead of deleting same-numbered cards from unrelated sets.
    cards: filteredCards ?? session.cards,
    openingEvents,
  };
}

export function mergeOpeningSessions(
  current: OpeningSession,
  pending: OpeningSession,
): OpeningSession {
  const eventIds = new Set(current.openingEvents.map((event) => event.id));
  const pendingEvents = pending.openingEvents.filter((event) => !eventIds.has(event.id));
  const currentEventTotals = openingEventTotals(current.openingEvents);
  const pendingEventTotals = openingEventTotals(pending.openingEvents);
  const currentLegacy = {
    boxes: Math.max(0, current.boxes - currentEventTotals.boxes),
    packs: Math.max(0, current.packs - currentEventTotals.packs),
    cost: Math.max(0, current.cost - currentEventTotals.cost),
  };
  const pendingLegacy = {
    boxes: Math.max(0, pending.boxes - pendingEventTotals.boxes),
    packs: Math.max(0, pending.packs - pendingEventTotals.packs),
    cost: Math.max(0, pending.cost - pendingEventTotals.cost),
  };
  const hasPendingLegacy = pendingLegacy.boxes > 0
    || pendingLegacy.packs > 0
    || pendingLegacy.cost > 0
    || (pending.openingEvents.length === 0 && pending.cards.length > 0);
  if (pendingEvents.length === 0 && !hasPendingLegacy) return current;

  const includesWholePendingSession = pendingEvents.length === pending.openingEvents.length;
  const pendingEventIds = new Set(pendingEvents.map((event) => event.id));
  const pendingCards = cardsForEvents(pending, (event) => pendingEventIds.has(event.id));
  const openingEvents = [...current.openingEvents, ...pendingEvents];
  const mergedEventTotals = openingEventTotals(openingEvents);
  return {
    boxes: mergedEventTotals.boxes + currentLegacy.boxes
      + (includesWholePendingSession ? pendingLegacy.boxes : 0),
    packs: mergedEventTotals.packs + currentLegacy.packs
      + (includesWholePendingSession ? pendingLegacy.packs : 0),
    cost: mergedEventTotals.cost + currentLegacy.cost
      + (includesWholePendingSession ? pendingLegacy.cost : 0),
    cards: [
      ...current.cards,
      ...(pendingCards ?? (includesWholePendingSession ? pending.cards : [])),
    ],
    openingEvents,
  };
}

export function mergeGuestOpeningIntoOwner(ownerId: string): OpeningSession {
  const merged = mergeOpeningSessions(loadOpeningSession(ownerId), getGuestOpeningSession());
  saveOpeningSession(merged, ownerId);
  return merged;
}

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

export function getOpeningHitCards(cards: Card[], setMeta?: Pick<SetMeta, 'code' | 'type'>): Card[] {
  if (setMeta?.type === 'starter') return cards;

  return cards.filter((card) => getCardReferenceValueKrw(card, setMeta?.code) > 0);
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
