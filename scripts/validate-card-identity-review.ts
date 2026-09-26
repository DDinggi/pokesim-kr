/** Regression checks for reviewed identity/classification fixes and restored hit pools. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';
const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const root = resolve(import.meta.dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const priceMap = read('data/prices/price-matches.json').cards;
const koreanReview = read('data/manual/korean-image-review-20260926.json').cards;
for (const filename of ['card-identity-review-20260909.json', 'card-classification-review-20260910.json']) {
  for (const row of read(`data/manual/${filename}`)) {
    const set = read(`data/sets/${row.set}.json`);
    const card = set.cards.find((c: any) => c.card_num === row.card_num);
    for (const key of ['name_ko', 'rarity', 'number', 'hp', 'type', 'card_type', 'image_url', 'price_ref_krw', 'price_source']) {
      const newer = koreanReview.find((entry: any) => entry.set === row.set && entry.id === row.card_num);
      assert.deepEqual(card[key], (newer?.after ?? row.after)[key], `${row.card_num}: ${key}`);
    }
    if (row.after._jp_number) assert.equal(priceMap[card.card_num].fullahead_number, row.after._jp_number);
    assert.deepEqual(set, read(`frontend/public/sets/${row.set}.json`));
  }
}
const specs = [
  ['sv4a-shiny-treasure-ex', 'S', 3, 3, 0.3],
  ['sv8a-terastal-festa', 'ACE', 1, 1, 0.1],
  ['s4a-shiny-star-v', 'A', 1, 2, 0.15],
  ['sm12a-tag-team-gx-tag-all-stars', 'PR', 0, 1, 0.0996],
] as const;
for (const [code, rarity, min, max, packRate] of specs) {
  const set = read(`data/sets/${code}.json`) as SetMeta;
  const expected = new Set(set.cards.map(c => c.card_num));
  const seen = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    const box = simulateBox(set.cards, set.box_size, set.type, set.pack_size, `identity-box-${i}`, code);
    const cards = box.packs.flatMap(p => p.cards);
    assert(box.packs.every(p => p.cards.length === set.pack_size), `${code}: malformed box pack`);
    const hits = cards.filter(c => c.rarity === rarity);
    assert(hits.length >= min && hits.length <= max, `${code}: ${rarity} count ${hits.length}`);
    if (rarity === 'S' || rarity === 'A') assert.equal(new Set(hits.map(c => c.card_num)).size, hits.length);
    cards.forEach(c => seen.add(c.card_num));
  }
  assert.deepEqual([...expected].filter(id => !seen.has(id)), [], `${code}: box unreachable`);
  let hits = 0;
  const packSeen = new Set<string>();
  const allPackSeen = new Set<string>();
  for (let i = 0; i < 20000; i++) {
    const { pack } = simulatePack(set.cards, set.type, set.pack_size, `identity-pack-${i}`, code);
    assert.equal(pack.cards.length, set.pack_size);
    hits += pack.cards.filter(c => c.rarity === rarity).length;
    pack.cards.forEach(c => allPackSeen.add(c.card_num));
    pack.cards.filter(c => c.rarity === rarity).forEach(c => packSeen.add(c.card_num));
  }
  assert(Math.abs(hits / 20000 - packRate) < 0.02, `${code}: pack rate ${hits / 20000}`);
  assert.equal(packSeen.size, set.cards.filter(c => c.rarity === rarity).length);
  assert.deepEqual([...expected].filter(id => !allPackSeen.has(id)), [], `${code}: loose-pack unreachable`);
  console.log(`${code}: all ${expected.size} cards reached in 3000 boxes; ${rarity} pack rate ${hits / 20000}`);
}
console.log('Identity review and restored rarity regression checks passed.');
