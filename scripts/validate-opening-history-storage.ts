import assert from 'node:assert/strict';
import openingHistoryDefault from '../frontend/lib/openingHistory.ts';
import recordBackupDefault from '../frontend/lib/recordBackup.ts';
import type { Card } from '../frontend/lib/types.ts';
import type { OpeningEvent, OpeningSession } from '../frontend/lib/openingHistory.ts';

const {
  SESSION_STORAGE_KEY,
  RECENT_OPENING_DETAIL_BOX_LIMIT,
  getRecentOpeningDetailCards,
  hasRecentOpeningDetailCards,
  loadOpeningSession,
  removeOpeningSet,
  saveOpeningSession,
} = openingHistoryDefault as unknown as typeof import('../frontend/lib/openingHistory.ts');
const {
  buildRecordSourceSnapshot,
} = recordBackupDefault as unknown as typeof import('../frontend/lib/recordBackup.ts');

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
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage,
    sessionStorage: new MemoryStorage(),
    location: { hostname: 'test.local', search: '' },
    dispatchEvent: () => true,
  },
});

function cardForBox(boxIndex: number, rarity: string | null = null): Card {
  return {
    card_num: `BOX-${boxIndex}-${rarity ?? 'C'}`,
    number: boxIndex,
    name_ko: `기록 테스트 카드 ${boxIndex}`,
    rarity,
    card_type: '포켓몬',
    subtype: rarity ? 'ex' : null,
    hp: 330,
    type: '초',
    image_url: `wmimages/TEST/TEST_${boxIndex}.png`,
    price_ref_krw: rarity ? 120_000 : null,
    price_ref_jpy: null,
    price_ref_usd: null,
    price_source: rarity ? 'manual:test' : null,
    price_updated_at: '2026-07-17',
    price_confidence: rarity ? 'manual' : null,
  };
}

function openingSession(boxes: number): OpeningSession {
  const cardsPerBox = 150;
  const cards: Card[] = [];
  const openingEvents: OpeningEvent[] = [];

  for (let boxIndex = 0; boxIndex < boxes; boxIndex += 1) {
    const commonCard = cardForBox(boxIndex);
    const hitCard = cardForBox(boxIndex, 'SAR');
    cards.push(...Array.from({ length: cardsPerBox }, (_, cardIndex) => (
      cardIndex === cardsPerBox - 1 ? hitCard : commonCard
    )));
    openingEvents.push({
      id: `box-${boxIndex}`,
      createdAt: new Date(Date.UTC(2026, 6, 17, 0, boxIndex)).toISOString(),
      setCode: boxIndex % 2 === 0 ? 'set-a' : 'set-b',
      unit: 'box',
      source: 'box-simulator',
      boxCount: 1,
      packCount: 30,
      cardCount: cardsPerBox,
      krw: 50_000,
      rarityCounts: { SAR: 1, C: cardsPerBox - 1 },
      hitCards: [hitCard],
    });
  }

  return {
    boxes,
    packs: 0,
    cost: boxes * 50_000,
    cards,
    openingEvents,
  };
}

assert.equal(RECENT_OPENING_DETAIL_BOX_LIMIT, 20);

const userId = '00000000-0000-4000-8000-000000000020';
const original = openingSession(25);
assert.equal(saveOpeningSession(original, userId, { notify: false }), true);

const stored = loadOpeningSession(userId);
assert.equal(stored.boxes, 25, 'all-time box total must remain');
assert.equal(stored.cost, 1_250_000, 'all-time cost must remain');
assert.equal(stored.openingEvents.length, 25, 'all aggregate events must remain');
assert.equal(stored.cards.length, 3_000, 'only twenty 150-card boxes retain detail cards');
assert.equal(stored.cards[0].card_num, 'BOX-5-C', 'the oldest retained detail is box 6');
assert.equal(stored.cards.at(-1)?.card_num, 'BOX-24-SAR');
assert.equal(getRecentOpeningDetailCards(stored).length, 3_000);
assert.equal(hasRecentOpeningDetailCards(stored), true);

const snapshot = buildRecordSourceSnapshot(userId);
assert.equal(snapshot.o['set-a']?.b?.n, 13);
assert.equal(snapshot.o['set-b']?.b?.n, 12);
assert.equal(snapshot.o['set-a']?.b?.r.SAR, 13);
assert.equal(snapshot.o['set-b']?.b?.r.SAR, 12);

const setACardNumbers = new Set(
  Array.from({ length: 25 }, (_, boxIndex) => boxIndex)
    .filter((boxIndex) => boxIndex % 2 === 0)
    .flatMap((boxIndex) => [`BOX-${boxIndex}-C`, `BOX-${boxIndex}-SAR`]),
);
const withoutSetA = removeOpeningSet(stored, 'set-a', setACardNumbers);
assert.equal(withoutSetA.openingEvents.every((event) => event.setCode === 'set-b'), true);
assert.equal(
  withoutSetA.cards.some((card) => setACardNumbers.has(card.card_num)),
  false,
  'set reset must remove matching cards from capped detail history',
);

const raw = JSON.parse(localStorage.getItem(
  `pokesim-kr-session-v1:user:${encodeURIComponent(userId)}`,
) ?? '{}') as OpeningSession;
assert.equal(raw.cards.length, 3_000);
assert.equal('_source' in (raw.cards[0] ?? {}), false);

console.log(
  'opening history storage validation passed: recent 20-box details, all-time aggregates, backup snapshot, set reset',
);

