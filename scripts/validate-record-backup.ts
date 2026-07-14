import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import recordBackupDefault from '../frontend/lib/recordBackup.ts';
import openingHistoryDefault from '../frontend/lib/openingHistory.ts';
import type { CloudRecordBackup } from '../frontend/lib/recordBackup.ts';
import type { OpeningEvent, OpeningSession } from '../frontend/lib/openingHistory.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const {
  assertRecordBackupPayload,
  buildDisplayedRecords,
  getRecordSourceId,
  normalizeRecordBackupPayload,
  withCurrentRecordSource,
} = recordBackupDefault as unknown as typeof import('../frontend/lib/recordBackup.ts');
const {
  clearOwnerOpeningSession,
  loadOpeningSession,
  mergeOpeningSessions,
  saveOpeningSession,
} = openingHistoryDefault as unknown as typeof import('../frontend/lib/openingHistory.ts');

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage,
    sessionStorage,
    location: { hostname: 'test.local', search: '' },
    dispatchEvent: () => true,
  },
});

function openingEvent(id: string, setCode = 'test-set'): OpeningEvent {
  return {
    id,
    createdAt: '2026-07-14T00:00:00.000Z',
    setCode,
    unit: 'box',
    source: 'box-simulator',
    boxCount: 1,
    packCount: 0,
    cardCount: 0,
    krw: 50_000,
    rarityCounts: { SAR: 1 },
    hitCards: [],
  };
}

function openingSession(...eventIds: string[]): OpeningSession {
  const openingEvents = eventIds.map((id) => openingEvent(id));
  return {
    boxes: openingEvents.length,
    packs: 0,
    cost: openingEvents.length * 50_000,
    cards: [],
    openingEvents,
  };
}

function emptySource(index: number) {
  return {
    u: new Date(Date.UTC(2026, 6, index + 1)).toISOString(),
    o: {},
    d: { [`test-set:${index}`]: 1 },
  };
}

const userA = '00000000-0000-4000-8000-00000000000a';
const userB = '00000000-0000-4000-8000-00000000000b';

saveOpeningSession(openingSession('guest-1'), null, { notify: false });
saveOpeningSession(openingSession('user-a-1'), userA, { notify: false });
saveOpeningSession(openingSession('user-b-1', 'user-b-2'), userB, { notify: false });

assert.equal(loadOpeningSession(null).boxes, 1, 'guest opening records must remain isolated');
assert.equal(loadOpeningSession(userA).boxes, 1, 'user A records must remain isolated');
assert.equal(loadOpeningSession(userB).boxes, 2, 'user B records must remain isolated');

const mergedOnce = mergeOpeningSessions(loadOpeningSession(userA), loadOpeningSession(null));
const mergedTwice = mergeOpeningSessions(mergedOnce, loadOpeningSession(null));
assert.equal(mergedOnce.boxes, 2, 'guest records should merge once');
assert.equal(mergedTwice.boxes, 2, 'repeating the same merge must not duplicate events');

const sets = [{ code: 'test-set', name_ko: '테스트 세트', cards: [] }] as SetMeta[];
const currentSourcePayload = withCurrentRecordSource({ v: 1, s: {} }, userA);
const currentSourceId = getRecordSourceId();
assert.ok(currentSourcePayload.s[currentSourceId], 'current browser source must be included');

const cloudWithCurrentSource: CloudRecordBackup = {
  payload: currentSourcePayload,
  revision: 1,
};
assert.equal(
  buildDisplayedRecords(cloudWithCurrentSource, userA, sets).session.boxes,
  1,
  'the current browser source must not be counted from cloud and local cache twice',
);

const eightSources = normalizeRecordBackupPayload({
  v: 1,
  s: Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`source-${index}`, emptySource(index)])),
});
assert.equal(Object.keys(eightSources.s).length, 8);
assert.doesNotThrow(() => assertRecordBackupPayload(eightSources));

const nineSources = normalizeRecordBackupPayload({
  v: 1,
  s: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`source-${index}`, emptySource(index)])),
});
assert.equal(
  Object.keys(nineSources.s).length,
  9,
  'normalization must not silently discard an over-limit source',
);
assert.throws(
  () => assertRecordBackupPayload(nineSources),
  /연결된 브라우저가 너무 많습니다/,
  'an over-limit backup must fail visibly instead of reporting a false success',
);

clearOwnerOpeningSession(userA);
assert.equal(loadOpeningSession(userA).boxes, 0, 'account deletion must clear the deleted user cache');
assert.equal(loadOpeningSession(userB).boxes, 2, 'account deletion must not clear another user cache');
assert.equal(loadOpeningSession(null).boxes, 1, 'account deletion must preserve guest records');

const deleteAccountMigration = readFileSync(
  new URL('../supabase/migrations/20260714000011_delete_user_account.sql', import.meta.url),
  'utf8',
);
assert.match(deleteAccountMigration, /function public\.delete_my_account\(\)/);
assert.match(deleteAccountMigration, /current_user_id uuid := auth\.uid\(\)/);
assert.match(deleteAccountMigration, /delete from auth\.users\s+where id = current_user_id/);
assert.match(deleteAccountMigration, /grant execute on function public\.delete_my_account\(\) to authenticated/);
assert.doesNotMatch(
  deleteAccountMigration,
  /delete_my_account\([^)]*(?:user|uuid)/i,
  'the client must not be allowed to choose which account is deleted',
);

console.log('record backup validation passed: isolation, merge idempotency, source dedupe, source limit, account deletion boundaries');
