import type { Card, SetMeta } from './types';
import {
  EMPTY_OPENING_SESSION,
  loadOpeningSession,
  saveOpeningSession,
  type OpeningEvent,
  type OpeningSession,
} from './openingHistory';
import {
  EMPTY_HIT_DEX_STATE,
  getHitDexCardKey,
  loadHitDex,
  mergeHitDexStates,
  saveHitDex,
  type HitDexEntry,
  type HitDexState,
} from './hitDex';
import { supabase } from './supabase';
import { getCardReferenceValueKrw } from './valueLuck';

const RECORD_BACKUP_VERSION = 1;
const RECORD_SOURCE_ID_KEY = 'pokesim-kr-record-source-v1';
const MAX_BACKUP_BYTES = 64 * 1024;
const MAX_BACKUP_SOURCES = 8;

type CountMap = Record<string, number>;

interface CompactOpeningBucket {
  n: number;
  k: number;
  c: number;
  r: CountMap;
  h: CountMap;
}

interface CompactSetOpening {
  b?: CompactOpeningBucket;
  p?: CompactOpeningBucket;
}

export interface RecordSourceSnapshot {
  u: string;
  o: Record<string, CompactSetOpening>;
  d: CountMap;
}

export interface RecordBackupPayload {
  v: number;
  s: Record<string, RecordSourceSnapshot>;
}

export interface CloudRecordBackup {
  payload: RecordBackupPayload;
  revision: number;
}

export const EMPTY_RECORD_BACKUP: CloudRecordBackup = {
  payload: { v: RECORD_BACKUP_VERSION, s: {} },
  revision: 0,
};

function finiteCount(value: unknown, maximum = 1_000_000): number {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) ? Math.max(0, Math.min(count, maximum)) : 0;
}

function normalizeCountMap(value: unknown): CountMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const counts: CountMap = {};
  for (const [key, rawCount] of Object.entries(value as Record<string, unknown>)) {
    if (!key || key.length > 160) continue;
    const count = finiteCount(rawCount);
    if (count > 0) counts[key] = count;
  }
  return counts;
}

function normalizeBucket(value: unknown): CompactOpeningBucket | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const openings = finiteCount(record.n, 100_000);
  if (openings === 0) return undefined;

  return {
    n: openings,
    k: finiteCount(record.k, 10_000_000_000),
    c: finiteCount(record.c, 10_000_000),
    r: normalizeCountMap(record.r),
    h: normalizeCountMap(record.h),
  };
}

function normalizeSource(value: unknown): RecordSourceSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const openings = record.o && typeof record.o === 'object' && !Array.isArray(record.o)
    ? record.o as Record<string, unknown>
    : {};
  const normalizedOpenings: Record<string, CompactSetOpening> = {};

  for (const [setCode, rawSet] of Object.entries(openings)) {
    if (!setCode || setCode.length > 100 || !rawSet || typeof rawSet !== 'object') continue;
    const setRecord = rawSet as Record<string, unknown>;
    const box = normalizeBucket(setRecord.b);
    const pack = normalizeBucket(setRecord.p);
    if (box || pack) normalizedOpenings[setCode] = { b: box, p: pack };
  }

  return {
    u: typeof record.u === 'string' ? record.u : new Date(0).toISOString(),
    o: normalizedOpenings,
    d: normalizeCountMap(record.d),
  };
}

export function normalizeRecordBackupPayload(value: unknown): RecordBackupPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_RECORD_BACKUP.payload;
  }

  const record = value as Record<string, unknown>;
  const rawSources = record.s && typeof record.s === 'object' && !Array.isArray(record.s)
    ? record.s as Record<string, unknown>
    : {};
  const sources: Record<string, RecordSourceSnapshot> = {};

  for (const [sourceId, rawSource] of Object.entries(rawSources)) {
    if (!sourceId || sourceId.length > 100) continue;
    const source = normalizeSource(rawSource);
    if (source) sources[sourceId] = source;
  }

  return { v: RECORD_BACKUP_VERSION, s: sources };
}

export function getRecordSourceId(): string {
  if (typeof window === 'undefined') return 'server';

  const existing = window.localStorage.getItem(RECORD_SOURCE_ID_KEY);
  if (existing) return existing;

  const sourceId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(RECORD_SOURCE_ID_KEY, sourceId);
  return sourceId;
}

function addCount(target: CountMap, key: string, count = 1): void {
  if (!key || count <= 0) return;
  target[key] = (target[key] ?? 0) + count;
}

function createEmptyBucket(): CompactOpeningBucket {
  return { n: 0, k: 0, c: 0, r: {}, h: {} };
}

export function buildRecordSourceSnapshot(userId: string): RecordSourceSnapshot {
  const session = loadOpeningSession(userId);
  const hitDex = loadHitDex(userId);
  const openings: Record<string, CompactSetOpening> = {};

  for (const event of session.openingEvents) {
    const setOpening = openings[event.setCode] ?? {};
    const key = event.unit === 'pack' ? 'p' : 'b';
    const bucket = setOpening[key] ?? createEmptyBucket();
    bucket.n += event.unit === 'pack' ? event.packCount : event.boxCount;
    bucket.k += event.krw;
    bucket.c += event.cardCount;
    for (const [rarity, count] of Object.entries(event.rarityCounts)) {
      addCount(bucket.r, rarity, count);
    }
    for (const card of event.hitCards ?? []) {
      addCount(bucket.h, card.card_num);
    }
    setOpening[key] = bucket;
    openings[event.setCode] = setOpening;
  }

  const dexCounts: CountMap = {};
  for (const entry of hitDex.entries) {
    dexCounts[entry.key] = entry.pullCount;
  }

  return {
    u: new Date().toISOString(),
    o: openings,
    d: dexCounts,
  };
}

function buildCardLookups(sets: SetMeta[]) {
  const cardsBySet = new Map<string, Map<string, Card>>();
  const dexCards = new Map<string, { set: SetMeta; card: Card }>();

  for (const set of sets) {
    cardsBySet.set(set.code, new Map(set.cards.map((card) => [card.card_num, card])));
    for (const card of set.cards) {
      dexCards.set(getHitDexCardKey(card, set.code), { set, card });
    }
  }
  return { cardsBySet, dexCards };
}

function cardsFromCounts(counts: CountMap, cardsByNumber: Map<string, Card> | undefined): Card[] {
  if (!cardsByNumber) return [];
  const cards: Card[] = [];
  for (const [cardNum, rawCount] of Object.entries(counts)) {
    const card = cardsByNumber.get(cardNum);
    if (!card) continue;
    const count = finiteCount(rawCount, 10_000);
    for (let index = 0; index < count; index += 1) cards.push(card);
  }
  return cards;
}

function buildSessionFromSources(
  sources: Record<string, RecordSourceSnapshot>,
  sets: SetMeta[],
): OpeningSession {
  const { cardsBySet } = buildCardLookups(sets);
  const events: OpeningEvent[] = [];
  const cards: Card[] = [];

  for (const [sourceId, source] of Object.entries(sources)) {
    for (const [setCode, opening] of Object.entries(source.o)) {
      for (const [unitKey, bucket] of [['b', opening.b], ['p', opening.p]] as const) {
        if (!bucket) continue;
        const unit = unitKey === 'p' ? 'pack' : 'box';
        const hitCards = cardsFromCounts(bucket.h, cardsBySet.get(setCode));
        cards.push(...hitCards);
        events.push({
          id: `backup:${sourceId}:${setCode}:${unit}`,
          createdAt: source.u,
          setCode,
          unit,
          source: unit === 'pack' ? 'vending-machine' : 'box-simulator',
          boxCount: unit === 'box' ? bucket.n : 0,
          packCount: unit === 'pack' ? bucket.n : 0,
          cardCount: bucket.c,
          krw: bucket.k,
          rarityCounts: bucket.r,
          hitCards,
        });
      }
    }
  }

  return {
    boxes: events.reduce((sum, event) => sum + event.boxCount, 0),
    packs: events.reduce((sum, event) => sum + (event.unit === 'pack' ? event.packCount : 0), 0),
    cost: events.reduce((sum, event) => sum + event.krw, 0),
    cards,
    openingEvents: events,
  };
}

function buildHitDexFromSources(
  sources: Record<string, RecordSourceSnapshot>,
  sets: SetMeta[],
): HitDexState {
  const { dexCards } = buildCardLookups(sets);
  const entries = new Map<string, HitDexEntry>();

  for (const source of Object.values(sources)) {
    for (const [key, rawCount] of Object.entries(source.d)) {
      const catalog = dexCards.get(key);
      if (!catalog) continue;
      const count = finiteCount(rawCount);
      if (count === 0) continue;
      const existing = entries.get(key);
      if (existing) {
        existing.pullCount += count;
        if (source.u > existing.lastPulledAt) existing.lastPulledAt = source.u;
        if (source.u < existing.firstPulledAt) existing.firstPulledAt = source.u;
        continue;
      }

      entries.set(key, {
        key,
        setCode: catalog.set.code,
        setNameKo: catalog.set.name_ko,
        cardNum: catalog.card.card_num,
        firstPulledAt: source.u,
        lastPulledAt: source.u,
        pullCount: count,
        bestPriceRefKrw: getCardReferenceValueKrw(catalog.card, catalog.set.code),
        card: catalog.card,
      });
    }
  }

  const updatedAt = Object.values(sources).map((source) => source.u).sort().at(-1) ?? null;
  return { version: 1, updatedAt, entries: Array.from(entries.values()) };
}

export function buildDisplayedRecords(
  cloud: CloudRecordBackup,
  userId: string | null,
  sets: SetMeta[],
): { session: OpeningSession; hitDex: HitDexState } {
  if (!userId) {
    return { session: loadOpeningSession(null), hitDex: loadHitDex(null) };
  }

  const sourceId = getRecordSourceId();
  const remoteSources = { ...cloud.payload.s };
  delete remoteSources[sourceId];
  const localSession = loadOpeningSession(userId);
  const remoteSession = buildSessionFromSources(remoteSources, sets);
  return {
    session: {
      boxes: localSession.boxes + remoteSession.boxes,
      packs: localSession.packs + remoteSession.packs,
      cost: localSession.cost + remoteSession.cost,
      cards: [...localSession.cards, ...remoteSession.cards],
      openingEvents: [...localSession.openingEvents, ...remoteSession.openingEvents],
    },
    hitDex: mergeHitDexStates(
      loadHitDex(userId),
      buildHitDexFromSources(remoteSources, sets),
      'sum',
    ),
  };
}

export function hydrateCurrentRecordSource(
  userId: string,
  cloud: CloudRecordBackup,
  sets: SetMeta[],
): void {
  const source = cloud.payload.s[getRecordSourceId()];
  if (!source) return;

  const localSession = loadOpeningSession(userId);
  if (localSession.openingEvents.length === 0 && localSession.cards.length === 0) {
    saveOpeningSession(buildSessionFromSources({ current: source }, sets), userId, { notify: false });
  }

  const localDex = loadHitDex(userId);
  if (localDex.entries.length === 0) {
    saveHitDex(buildHitDexFromSources({ current: source }, sets), userId, { notify: false });
  }
}

export async function fetchRecordBackup(userId: string): Promise<CloudRecordBackup> {
  if (!supabase) throw new Error('Google 기록 보관 설정을 확인할 수 없습니다.');

  const { data, error } = await supabase
    .from('user_record_backups')
    .select('payload,revision')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_RECORD_BACKUP;

  return {
    payload: normalizeRecordBackupPayload(data.payload),
    revision: finiteCount(data.revision, Number.MAX_SAFE_INTEGER),
  };
}

export function assertRecordBackupPayload(payload: RecordBackupPayload): void {
  const byteLength = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (byteLength > MAX_BACKUP_BYTES) {
    throw new Error('기록 백업 용량이 가득 찼습니다. 최근 기록을 정리한 뒤 다시 시도해주세요.');
  }
  if (Object.keys(payload.s).length > MAX_BACKUP_SOURCES) {
    throw new Error('연결된 브라우저가 너무 많습니다. 기록 백업을 정리한 뒤 다시 시도해주세요.');
  }
}

function isRevisionConflict(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'message' in error
      && String((error as { message: unknown }).message).includes('record_revision_conflict'),
  );
}

export async function updateRecordBackup(
  userId: string,
  current: CloudRecordBackup,
  update: (payload: RecordBackupPayload) => RecordBackupPayload,
): Promise<CloudRecordBackup> {
  if (!supabase) throw new Error('Google 기록 보관 설정을 확인할 수 없습니다.');

  let base = current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const payload = normalizeRecordBackupPayload(update(base.payload));
    assertRecordBackupPayload(payload);
    const { data, error } = await supabase.rpc('save_user_record_backup', {
      p_payload: payload,
      p_expected_revision: base.revision,
    });
    if (!error) {
      const result = data as { payload?: unknown; revision?: unknown } | null;
      return {
        payload: normalizeRecordBackupPayload(result?.payload ?? payload),
        revision: finiteCount(result?.revision ?? base.revision + 1, Number.MAX_SAFE_INTEGER),
      };
    }
    if (!isRevisionConflict(error) || attempt === 1) throw error;
    base = await fetchRecordBackup(userId);
  }

  return base;
}

export function withCurrentRecordSource(
  payload: RecordBackupPayload,
  userId: string,
): RecordBackupPayload {
  const sourceId = getRecordSourceId();
  const source = buildRecordSourceSnapshot(userId);
  const sources = { ...payload.s };
  if (Object.keys(source.o).length === 0 && Object.keys(source.d).length === 0) {
    delete sources[sourceId];
  } else {
    sources[sourceId] = source;
  }
  return {
    v: RECORD_BACKUP_VERSION,
    s: sources,
  };
}

export function withoutOpeningRecords(
  payload: RecordBackupPayload,
  setCode?: string,
): RecordBackupPayload {
  const sources: Record<string, RecordSourceSnapshot> = {};
  for (const [sourceId, source] of Object.entries(payload.s)) {
    const openings = setCode
      ? Object.fromEntries(Object.entries(source.o).filter(([code]) => code !== setCode))
      : {};
    sources[sourceId] = { ...source, u: new Date().toISOString(), o: openings };
  }
  return { v: RECORD_BACKUP_VERSION, s: sources };
}

export function emptyDisplayedRecords(): { session: OpeningSession; hitDex: HitDexState } {
  return { session: EMPTY_OPENING_SESSION, hitDex: EMPTY_HIT_DEX_STATE };
}
