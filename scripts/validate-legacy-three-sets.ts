/** Activation and reachability regression; these samples do not measure real pull rates. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import seriesDefault from '../frontend/lib/setSeries.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { getSetSeriesKey } = seriesDefault as unknown as typeof import('../frontend/lib/setSeries.ts');
const { premiumSparkleVariant, premiumPriceSparkleVariant } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const root = resolve(import.meta.dirname, '..');
const codes = ['smp2-detective-pikachu', 's8a-25th-anniversary', 'xy6-emerald-break'];
const index = JSON.parse(readFileSync(resolve(root, 'data/sets-index.json'), 'utf8'));
const page = readFileSync(resolve(root, 'frontend/app/page.tsx'), 'utf8');
const close = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);

for (const code of codes) {
  const source = readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8');
  assert.equal(source, readFileSync(resolve(root, `frontend/public/sets/${code}.json`), 'utf8'), `${code}: public copy is stale`);
  const set = JSON.parse(source) as SetMeta;
  assert.ok(index.active_sets.includes(code), `${code}: missing from active index`);
  assert.ok(!index.planned_sets.includes(code), `${code}: still planned`);
  assert.ok(page.includes(`/sets/${code}.json`), `${code}: missing static import`);
  assert.ok(existsSync(resolve(root, `frontend/public/boxes/${code}.png`)));
  assert.ok(existsSync(resolve(root, `frontend/public/boxes/thumbs/${code}.webp`)));
  assert.equal(new Set(set.cards.map(card => card.card_num)).size, set.cards.length);
  for (const card of set.cards) {
    const price = card.price_ref_krw ?? 0;
    const expectedPriceEffect = card.price_confidence === 'proxy' || price < 100_000
      ? null : price >= 800_000 ? 'jackpot' : price >= 300_000 ? 'rare' : 'value';
    assert.equal(premiumPriceSparkleVariant(card), expectedPriceEffect, `${code}: price effect ${card.card_num}`);
    if (expectedPriceEffect || card.rarity === 'S8AP') {
      assert.equal(premiumSparkleVariant(card.rarity, card), expectedPriceEffect, `${code}: sparkle ${card.card_num}`);
    }
  }
  assert.equal(getSetSeriesKey(set), code.startsWith('xy') ? 'xy' : code.startsWith('smp') ? 'sm' : 'swsh');

  const seenBox = new Set<string>();
  const seenLoose = new Set<string>();
  const signatures = new Set<string>();
  let rr = 0;
  let noHigh = 0;
  for (let trial = 0; trial < 4000; trial++) {
    const seed = `legacy-three-${code}-${trial}`;
    const box = simulateBox(set.cards, set.box_size, set.type, set.pack_size, seed, code);
    const primary = box.packs.filter(pack => !pack.is_bonus);
    const bonus = box.packs.filter(pack => pack.is_bonus);
    assert.equal(primary.length, set.box_size);
    assert.equal(bonus.length, set.bonus_pack_count ?? 0);
    for (const pack of primary) assert.equal(pack.cards.length, set.pack_size);
    for (const pack of bonus) assert.equal(pack.cards.length, 1);
    const cards = box.packs.flatMap(pack => pack.cards);
    const summary: Record<string, number> = {};
    for (const card of cards) {
      seenBox.add(card.card_num);
      if (card.rarity) summary[card.rarity] = (summary[card.rarity] ?? 0) + 1;
    }
    assert.deepEqual(summary, box.summary, `${code}: summary omits cards`);
    if (trial < 3) assert.deepEqual(box, simulateBox(set.cards, set.box_size, set.type, set.pack_size, seed, code));
    if (trial < 20) signatures.add(cards.map(card => card.card_num).join('|'));
    rr += box.summary.RR ?? 0;
    if (!(box.summary.SR || box.summary.UR)) noHigh++;
    if (code === 'smp2-detective-pikachu') {
      assert.equal(cards.length, 100);
      assert.equal(box.summary.SR ?? 0, 0, 'Japanese-exclusive Yoshida SR returned');
      for (const pack of primary) checkDetectivePack(pack.cards);
    }
  }
  assert.equal(signatures.size, 20, `${code}: independent seeds produced repeated full results`);
  for (let trial = 0; trial < 60000; trial++) {
    const { pack } = simulatePack(set.cards, set.type, set.pack_size, `legacy-three-loose-${code}-${trial}`, code);
    assert.equal(pack.cards.length, set.pack_size);
    assert.ok(!pack.is_bonus);
    for (const card of pack.cards) seenLoose.add(card.card_num);
    if (code === 'smp2-detective-pikachu') checkDetectivePack(pack.cards);
    if (code === 's8a-25th-anniversary') assert.ok(pack.cards.every(card => card.rarity !== 'S8AP'));
  }
  for (const card of set.cards) {
    assert.ok(seenBox.has(card.card_num), `${code}: box cannot reach ${card.card_num}`);
    if (card.rarity !== 'S8AP') assert.ok(seenLoose.has(card.card_num), `${code}: loose pack cannot reach ${card.card_num}`);
  }
  if (code === 'smp2-detective-pikachu') {
    assert.equal(set.cards.length, 45);
    assert.ok(set.cards.every(card => card.number >= 1 && card.number <= 24 && card.rarity !== 'SR'));
    close(rr / 4000, 2.5, .15);
  }
  if (code === 'xy6-emerald-break') assert.ok(noHigh > 0 && noHigh < 4000, 'XY6 must allow SR/UR-free boxes');
  console.log(`${code}: ${set.cards.length} cards; registry/assets/public, 4,000 boxes, 60,000 loose packs, reachability and seed consistency passed`);
}

function checkDetectivePack(cards: Card[]): void {
  assert.equal(cards.filter(card => card.rarity === 'C' && card.subtype !== '미러').length, 3);
  assert.equal(cards.filter(card => card.rarity === 'U' && card.subtype !== '미러').length, 1);
  assert.equal(cards.filter(card => card.subtype === '미러' || card.rarity === 'RR').length, 1);
}
