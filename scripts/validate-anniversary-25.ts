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
const { ANNIVERSARY_25_LUCK_SCORE_WEIGHTS, ANNIVERSARY_25_PACK_EVENT_WEIGHTS, ANNIVERSARY_25_HIGH_PATTERNS, ANNIVERSARY_25_UNION_BOX_RATE } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
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
let unionBoxes = 0;
let srCards = 0;
const highPatterns = new Map<string, number>();
const scoreHistogram = new Map<number, number>();
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
  const sr = result.summary.SR ?? 0;
  const ur = result.summary.UR ?? 0;
  const high = sr + ur;
  assert.ok(high >= 1 && high <= 2);
  assert.equal(result.summary.RR, 5 - high);
  const union = main.filter(pack => pack.cards.some(card => card.number === 25)).length;
  const vmax = main.flatMap(pack => pack.cards).filter(card => card.rarity === 'RRR' && card.number < 25);
  assert.ok(union === 0 || union === 1, 'current approximation allows at most one V-UNION event');
  assert.equal(union + vmax.length, 2, 'two RRR events, counting V-UNION as one');
  assert.equal(new Set(vmax.map(card => card.card_num)).size, vmax.length, 'VMAX slots avoid duplicate cards');
  unionBoxes += union;
  srCards += sr;
  const pattern = `${sr},${ur}`;
  highPatterns.set(pattern, (highPatterns.get(pattern) ?? 0) + 1);
  assert.equal(result.summary.S8AP, 4);
  cards.forEach(card => seen.add(card.card_num));
  boxScore += score(cards);
  const scoreKey = Math.round(score(cards) * 10);
  scoreHistogram.set(scoreKey, (scoreHistogram.get(scoreKey) ?? 0) + 1);
  urBoxes += result.summary.UR ?? 0;
  boxRr += result.summary.RR ?? 0;
  boxRrr += result.summary.RRR ?? 0;
  if (index < 3) assert.deepEqual(result, simulateBox(set.cards, 16, set.type, 5, `anniversary-25-box-${index}`, code));
}
assert.equal(seen.size, 63, 'some registered card cannot be reached in boxes');
// Independent evidence constraints, not rates inferred from simulation trials.
close(urBoxes / boxTrials, 5 / 20, 0.025);
close(srCards / boxTrials, 18 / 20, 0.025);
close(boxRr / boxTrials, 77 / 20, 0.025);
close(unionBoxes / boxTrials, 19 / 28, 0.025);
close(boxRrr / boxTrials, 2 + 3 * 19 / 28, 0.08);
assert.ok((highPatterns.get('1,1') ?? 0) > 0, 'SR and UR must coexist');
assert.ok((highPatterns.get('2,0') ?? 0) > 0, 'two SR cards must be reachable');
assert.ok((highPatterns.get('0,1') ?? 0) > 0, 'UR-only boxes must be reachable');
close(ANNIVERSARY_25_HIGH_PATTERNS.reduce((sum, pattern) => sum + pattern.weight, 0), 1);
close(ANNIVERSARY_25_UNION_BOX_RATE, 19 / 28);

let packScore = 0;
const looseEvents: Record<string, number> = {};
const seenLoose = new Set<string>();
const packTrials = 40000;
for (let index = 0; index < packTrials; index++) {
  const { pack } = simulatePack(set.cards, set.type, 5, `anniversary-25-loose-${index}`, code);
  checkMainPack(pack);
  pack.cards.forEach(card => seenLoose.add(card.card_num));
  packScore += score(pack.cards);
  const event = pack.cards.some(card => card.number === 25) ? 'V_UNION'
    : pack.cards.find(card => card.rarity !== '25TH')?.rarity ?? '25TH';
  looseEvents[event] = (looseEvents[event] ?? 0) + 1;
}
assert.equal(seenLoose.size, 38, 'loose packs must reach all main cards and exclude promotion cards');
for (const [event, probability] of Object.entries(ANNIVERSARY_25_PACK_EVENT_WEIGHTS)) {
  close((looseEvents[event] ?? 0) / packTrials, probability, 0.006);
}

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
close(boxSummary.expectedScoreCounts!.UR, 5 / 20);
close(boxSummary.expectedScoreCounts!.SR, 18 / 20);
close(boxSummary.expectedScoreCounts!.RR, 77 / 20);
close(boxSummary.expectedScoreCounts!.RRR, 2 + 3 * 19 / 28);
close(packSummary.expectedScoreCounts!.UR, ANNIVERSARY_25_PACK_EVENT_WEIGHTS.UR);
close(boxScore / boxTrials, boxSummary.expectedScore!, 0.3);
close(packScore / packTrials, packSummary.expectedScore!, 0.025);
for (const outcome of boxSummary.scoreDistribution!) {
  close((scoreHistogram.get(Math.round(outcome.score * 10)) ?? 0) / boxTrials, outcome.probability, 0.025);
}
assert.ok([...scoreHistogram.keys()].every(key => boxSummary.scoreDistribution!.some(outcome => Math.round(outcome.score * 10) === key)), 'analytical box distribution covers all generated scores');
for (const rarity of ['25TH', 'RR', 'RRR', 'SR', 'UR']) {
  close(boxSummary.expectedScoreCounts![rarity], 16 * (packSummary.expectedScoreCounts![rarity] ?? 0));
}
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
let multiUnionSpecials = 0;
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
  if (result.packs.filter(pack => pack.cards.some(card => card.number === 25)).length > 1) multiUnionSpecials++;
  if (index < 3) assert.deepEqual(result, simulateBundle(special, `anniversary-special-${index}`));
}
assert.ok(noHigh > 0 && multiHigh > 0, 'a vending bundle must not inherit a box high-slot guarantee');
assert.ok(multiUnionSpecials > 0, 'independent vending packs must not inherit the sealed-box V-UNION cap');
close(specialScore / 2000, specialLuck.expectedScore!, 0.16);
console.log('25th vending special: 2,000 products; 4 independent boosters + 1 separate promo = 21 cards, original dex provenance, luck expectation and replay passed');
console.log(`${code}: 63 cards; 5,000 boxes/40,000 loose packs; two RRR events, V-UNION four-part packs, SR+UR/SR+SR, empirical marginal constraints, exact score distribution, bonus separation and replay passed`);
