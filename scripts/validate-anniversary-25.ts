/** Regression for the 25th main-pack events and separate promotion packs.
 * Simulation samples validate implementation, not real-world pull rates.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import luckDefault from '../frontend/lib/luck.ts';
import modelDefault from '../frontend/lib/simulation/model.ts';
import productsDefault from '../frontend/lib/anniversary25Products.ts';
import type { Card, PackResult, SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack, simulateBundle } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { getAnniversary25SpecialSet, getAnniversary25RecordSets } = productsDefault as unknown as typeof import('../frontend/lib/anniversary25Products.ts');
const { createLuckOpening, summarizeLuckRarityCounts } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const { ANNIVERSARY_25_LUCK_SCORE_WEIGHTS, ANNIVERSARY_25_PACK_EVENT_WEIGHTS } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const root = resolve(import.meta.dirname, '..');
const code = 's8a-25th-anniversary';
const source = readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8');
const set = JSON.parse(source) as SetMeta;
assert.equal(source, readFileSync(resolve(root, `frontend/public/sets/${code}.json`), 'utf8'));
assert.equal(set.cards.length, 63);
assert.equal(set.bonus_pack_count, 4);
assert.equal(set.box_size, 16);
assert.equal(set.pack_size, 5);
assert.equal(new Set(set.cards.map(card => card.card_num)).size, 63);
for (let number = 1; number <= 38; number++) {
  assert.ok(set.cards.some(card => card.number === number), `missing main card ${number}`);
}
assert.equal(set.cards.filter(card => card.rarity === 'S8AP').length, 25);
for (let number = 25; number <= 28; number++) {
  const card = set.cards.find(candidate => candidate.number === number)!;
  assert.equal(card.rarity, 'RRR');
  assert.equal(card.card_type, '포켓몬');
  assert.ok(card.image_url.includes(`/${String(number).padStart(3, '0')}.png`));
}
assert.equal(set.cards.find(card => card.number === 29)?.rarity, 'SR');
assert.equal(set.cards.find(card => card.number === 30)?.rarity, 'UR');

const close = (actual: number, expected: number, tolerance = 1e-8): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
};
function checkMainPack(pack: PackResult): void {
  assert.equal(pack.cards.length, 5);
  assert.ok(!pack.is_bonus);
  assert.ok(pack.cards.every(card => card.rarity !== 'S8AP'));
  assert.equal(pack.cards.filter(card => card.card_type === '에너지').length, 1);
  const union = pack.cards.filter(card => card.number >= 25 && card.number <= 28);
  if (union.length) assert.deepEqual(union.map(card => card.number).sort((a, b) => a - b), [25, 26, 27, 28]);
}
function score(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + (ANNIVERSARY_25_LUCK_SCORE_WEIGHTS[card.rarity ?? ''] ?? 0), 0);
}
const seen = new Set<string>();
let boxScore = 0;
let urBoxes = 0;
let boxRr = 0;
let boxRrr = 0;
const boxTrials = 5000;
for (let index = 0; index < boxTrials; index++) {
  const result = simulateBox(set.cards, 16, set.type, 5, `anniversary-25-box-${index}`, code);
  const main = result.packs.filter(pack => !pack.is_bonus);
  const bonus = result.packs.filter(pack => pack.is_bonus);
  assert.equal(main.length, 16);
  assert.equal(bonus.length, 4);
  main.forEach(checkMainPack);
  for (const pack of bonus) {
    assert.equal(pack.cards.length, 1);
    assert.equal(pack.cards[0].rarity, 'S8AP');
    assert.equal(pack.source_set_name_ko, '25주년 프로모팩');
    assert.equal(pack.source_set_code, undefined);
  }
  const cards = result.packs.flatMap(pack => pack.cards);
  assert.equal(cards.length, 84);
  assert.equal((result.summary.SR ?? 0) + (result.summary.UR ?? 0), 1, 'SR/UR are a shared high slot');
  assert.equal(result.summary.S8AP, 4);
  cards.forEach(card => seen.add(card.card_num));
  boxScore += score(cards);
  urBoxes += result.summary.UR ?? 0;
  boxRr += result.summary.RR ?? 0;
  boxRrr += result.summary.RRR ?? 0;
  if (index < 3) assert.deepEqual(result, simulateBox(set.cards, 16, set.type, 5, `anniversary-25-box-${index}`, code));
}
assert.equal(seen.size, 63, 'some registered card cannot be reached in boxes');
close(urBoxes / boxTrials, 0.05, 0.015);
close(boxRr / boxTrials, 16 * 13 / 52, 0.12);
close(boxRrr / boxTrials, 16 * (5 + 4 * 4) / 52, 0.25);

let packScore = 0;
const seenLoose = new Set<string>();
const packTrials = 40000;
for (let index = 0; index < packTrials; index++) {
  const { pack } = simulatePack(set.cards, set.type, 5, `anniversary-25-loose-${index}`, code);
  checkMainPack(pack);
  pack.cards.forEach(card => seenLoose.add(card.card_num));
  packScore += score(pack.cards);
}
assert.equal(seenLoose.size, 38, 'loose packs must reach all main cards and exclude promotion cards');

const boxSummary = summarizeLuckRarityCounts({}, createLuckOpening(set, { boxes: 1 }), set);
const packSummary = summarizeLuckRarityCounts({}, createLuckOpening(set, { packs: 1 }), set);
const mixedSummary = summarizeLuckRarityCounts({}, createLuckOpening(set, { boxes: 1, packs: 4 }), set);
for (const summary of [boxSummary, packSummary, mixedSummary]) {
  close(summary.scoreDistribution!.reduce((sum, outcome) => sum + outcome.probability, 0), 1);
}
close(Object.values(boxSummary.expectedScoreCounts!).reduce((a, b) => a + b, 0), 84);
close(Object.values(packSummary.expectedScoreCounts!).reduce((a, b) => a + b, 0), 5);
close(boxSummary.expectedScoreCounts!.S8AP, 4);
close(packSummary.expectedScoreCounts!.S8AP ?? 0, 0);
close(mixedSummary.expectedScoreCounts!.S8AP, 4);
close(boxSummary.expectedScoreCounts!.UR, 0.05);
close(packSummary.expectedScoreCounts!.UR, ANNIVERSARY_25_PACK_EVENT_WEIGHTS.UR);
close(boxScore / boxTrials, boxSummary.expectedScore!, 0.3);
close(packScore / packTrials, packSummary.expectedScore!, 0.025);
const urSummary = summarizeLuckRarityCounts({ UR: 1 }, createLuckOpening(set, { packs: 1 }), set);
assert.equal(urSummary.topCount, 1);
const special = getAnniversary25SpecialSet([set])!;
assert.equal(special.box_price_krw, 10000);
assert.equal(special.type, 'bundle');
assert.equal(getAnniversary25RecordSets([set]).length, 2);
assert.equal(getAnniversary25RecordSets(getAnniversary25RecordSets([set])).length, 2);
const specialLuck = summarizeLuckRarityCounts({}, createLuckOpening(special, { boxes: 1 }), special);
close(specialLuck.expectedScoreCounts!.S8AP, 1);
close(Object.values(specialLuck.expectedScoreCounts!).reduce((a, b) => a + b, 0), 21);
close(specialLuck.expectedScoreCounts!.UR, 4 * ANNIVERSARY_25_PACK_EVENT_WEIGHTS.UR);
let noHigh = 0;
let multiHigh = 0;
let specialScore = 0;
for (let index = 0; index < 2000; index++) {
  const result = simulateBundle(special, `anniversary-special-${index}`);
  assert.equal(result.packs.length, 5);
  result.packs.slice(0, 4).forEach(checkMainPack);
  assert.equal(result.packs[4].is_bonus, true);
  assert.equal(result.packs[4].cards.length, 1);
  assert.equal(result.packs[4].cards[0].rarity, 'S8AP');
  assert.equal(result.packs.flatMap(pack => pack.cards).length, 21);
  assert.ok(result.packs.every(pack => pack.source_set_code === code));
  assert.ok(result.packs.every(pack => pack.cards.every(card => card.source_set_code === code && card.opening_set_code === special.code)));
  const high = (result.summary.SR ?? 0) + (result.summary.UR ?? 0);
  if (high === 0) noHigh++;
  if (high > 1) multiHigh++;
  specialScore += score(result.packs.flatMap(pack => pack.cards));
  if (index < 3) assert.deepEqual(result, simulateBundle(special, `anniversary-special-${index}`));
}
assert.ok(noHigh > 0 && multiHigh > 0, 'a vending bundle must not inherit a box high-slot guarantee');
close(specialScore / 2000, specialLuck.expectedScore!, 0.16);
console.log('25th vending special: 2,000 products; 4 independent boosters + 1 separate promo = 21 cards, original dex provenance, luck expectation and replay passed');
console.log(`${code}: 63 cards; 5,000 boxes/40,000 loose packs; bonus separation, shared SR/UR slot, V-UNION four-part packs, reachability and luck-model expectations passed`);
