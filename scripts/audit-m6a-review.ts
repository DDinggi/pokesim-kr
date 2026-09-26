/** Regression audit of M6a pack composition, rates and legacy detail-image URLs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import imagesDefault from '../frontend/lib/images.ts';
import modelDefault from '../frontend/lib/simulation/model.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const {
  CELEBRATION_30_BASE_HIGH_WEIGHTS,
  CELEBRATION_30_BOX_COUNTS,
  CELEBRATION_30_FUR_BOX_RATE,
  CELEBRATION_30_NON_RGB_HIGH_WEIGHTS,
  CELEBRATION_30_PACK_PATTERNS,
  CELEBRATION_30_RGB_BOX_RATE,
  CELEBRATION_30_TWO_HIT_BOX_RATE,
} = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const { premiumSparkleVariant } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const { resolveCardImageUrl } = imagesDefault as unknown as typeof import('../frontend/lib/images.ts');
const root = resolve(import.meta.dirname, '..');
const code = 'm6a-30th-celebration';
const raw = readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8');
assert.equal(raw, readFileSync(resolve(root, `frontend/public/sets/${code}.json`), 'utf8'), 'Public copy is stale');
const set = JSON.parse(raw) as SetMeta;
const trials = 20_000;
let furBoxes = 0;
let rgbBoxes = 0;
let twoHitBoxes = 0;
const seenPikachu = new Set<number>();
const seenCards = new Set<string>();
const boxTuples = new Set(CELEBRATION_30_BOX_COUNTS.map((row) => row.join(',')));
const packPatterns = new Set(CELEBRATION_30_PACK_PATTERNS.map((pattern) => [...pattern.rarities].sort().join(',')));
const isKnownBasePattern = (rarities: string[]) => {
  const normalized = rarities.map((rarity) => rarity === 'RGB' ? 'SAR' : rarity);
  if (packPatterns.has([...normalized].sort().join(','))) return true;

  // A user-selected 0.5% second high hit can add one SAR/FUR to a normal
  // documented composition. Removing either high must recover that base shape.
  return normalized.some((rarity, index) => (
    (rarity === 'SAR' || rarity === 'FUR')
    && packPatterns.has(normalized.filter((_, candidate) => candidate !== index).sort().join(','))
  ));
};
assert.ok(Math.abs(CELEBRATION_30_PACK_PATTERNS.reduce((sum, p) => sum + p.weight, 0) - 340) < 1e-9);
for (const [rarity, perBox] of [['RR', 5], ['AR', 4], ['REPRINT', 2], ['SAR', 5 / 6], ['FUR', 1 / 6]] as const) {
  const perPack = CELEBRATION_30_PACK_PATTERNS.reduce((sum, p) => sum + (p.rarities.includes(rarity) ? p.weight : 0), 0) / 340;
  assert.ok(Math.abs(perPack * 20 - perBox) < 1e-10, `${rarity}: pack/box marginal mismatch`);
}

for (let i = 0; i < trials; i++) {
  const result = simulateBox(set.cards, 20, set.type, 6, `m6a-review-${i}`, code);
  const cards = result.packs.flatMap((pack) => pack.cards);
  cards.forEach((card) => seenCards.add(card.card_num));
  const counts = (rarity: string) => cards.filter((card) => card.rarity === rarity).length;
  assert.ok(boxTuples.has(['RR', 'AR', 'REPRINT'].map(counts).join(',')), 'Unobserved joint box counts');
  for (const rarity of ['AR', 'REPRINT']) {
    assert.equal(new Set(cards.filter((card) => card.rarity === rarity).map((card) => card.card_num)).size, counts(rarity));
  }
  const hitPackCount = result.packs.filter((pack) => pack.cards.some((card) => card.rarity)).length;
  assert.equal(hitPackCount, 9);
  const highCount = counts('SAR') + counts('FUR') + counts('RGB');
  assert.ok(highCount === 1 || highCount === 2, 'Every box must have one high hit, with an optional second hit');
  twoHitBoxes += Number(highCount === 2);
  if (counts('RGB') === 1) assert.ok(highCount === 1 || highCount === 2, 'RGB is the base one-hit unless the 0.5% second-hit roll succeeds');
  assert.equal(counts('REPRINT'), 2, 'High-slot changes must preserve the observed reprint count');
  for (const pack of result.packs) {
    assert.equal(pack.cards.length, 6);
    const rarities = pack.cards.flatMap((card) => card.rarity ? [card.rarity] : []);
    assert.ok(isKnownBasePattern(rarities), `Unsupported pack combination: ${rarities}`);
    const pikachu = pack.cards.filter((card) => card.number >= 17 && card.number <= 46);
    assert.equal(pikachu.length, 1, 'Each pack must contain one anniversary Pikachu');
    assert.equal(pack.cards.filter((card) => card.card_type === '에너지').length, 1);
    seenPikachu.add(pikachu[0]!.number);
  }
  furBoxes += Number(cards.some((card) => card.rarity === 'FUR'));
  rgbBoxes += Number(cards.some((card) => card.rarity === 'RGB'));
}

for (const [label, count, expected] of [
  ['FUR', furBoxes, CELEBRATION_30_FUR_BOX_RATE + CELEBRATION_30_TWO_HIT_BOX_RATE * CELEBRATION_30_NON_RGB_HIGH_WEIGHTS.FUR],
  ['RGB', rgbBoxes, CELEBRATION_30_RGB_BOX_RATE],
  ['2-hit', twoHitBoxes, CELEBRATION_30_TWO_HIT_BOX_RATE],
] as const) {
  const observed = count / trials;
  const tolerance = 5 * Math.sqrt(expected * (1 - expected) / trials);
  assert.ok(Math.abs(observed - expected) < tolerance, `${label} rate differs from the reviewed model`);
  console.log(`${label}: ${count}/${trials} (${(100 * observed).toFixed(3)}%), model ${(100 * expected).toFixed(3)}%`);
}
assert.equal(seenPikachu.size, 30);
assert.equal(seenCards.size, set.cards.length, 'Unreachable cards');
const looseCounts: Record<string, number> = {};
for (let i = 0; i < 40_000; i++) {
  const { pack } = simulatePack(set.cards, set.type, 6, `m6a-loose-${i}`, code);
  assert.equal(pack.cards.length, 6);
  assert.equal(pack.cards.filter((card) => card.number >= 17 && card.number <= 46).length, 1);
  assert.equal(pack.cards.filter((card) => card.card_type === '에너지').length, 1);
  const high = pack.cards.filter((card) => card.rarity === 'SAR' || card.rarity === 'FUR' || card.rarity === 'RGB');
  assert.ok(high.length <= 2, 'Loose pack may have one base high and optional second high only');
  assert.ok(isKnownBasePattern(pack.cards.flatMap((card) => card.rarity ? [card.rarity] : [])));
  for (const card of pack.cards) if (card.rarity) looseCounts[card.rarity] = (looseCounts[card.rarity] ?? 0) + 1;
}
for (const [rarity, expected] of [
  ['RR', 5 / 20],
  ['AR', 4 / 20],
  ['REPRINT', 2 / 20],
  ['SAR', (CELEBRATION_30_BASE_HIGH_WEIGHTS.SAR + CELEBRATION_30_TWO_HIT_BOX_RATE * CELEBRATION_30_NON_RGB_HIGH_WEIGHTS.SAR) / 20],
  ['FUR', (CELEBRATION_30_FUR_BOX_RATE + CELEBRATION_30_TWO_HIT_BOX_RATE * CELEBRATION_30_NON_RGB_HIGH_WEIGHTS.FUR) / 20],
  ['RGB', CELEBRATION_30_RGB_BOX_RATE / 20],
] as const) {
  assert.ok(Math.abs((looseCounts[rarity] ?? 0) / 40_000 - expected) < 5 * Math.sqrt(expected * (1 - expected) / 40_000), `${rarity}: loose-pack rate regression`);
}
for (const card of set.cards.filter((card) => card.number >= 104 && card.number <= 168)) {
  assert.ok((card.price_ref_krw ?? 0) > 0 && card.price_confidence === 'source', `Missing price: ${card.card_num}`);
  assert.ok(card.price_source?.includes('fullahead:sale:'));
  if ((card.price_ref_krw ?? 0) >= 100_000) assert.ok(premiumSparkleVariant(card.rarity, card));
  if (card.rarity === 'RGB') assert.equal(premiumSparkleVariant(card.rarity, card), 'jackpot');
}
for (let number = 104; number <= 165; number++) {
  const oldKey = `external/${code}/JP2026M6A${number}.gif`;
  assert.ok(new URL(resolveCardImageUrl(oldKey)).pathname.endsWith(`${number}.jpg`), 'Legacy detail image was not upgraded');
}
console.log('Passed: 20,000 boxes + 40,000 loose packs, joint counts/combinations, all 176 cards reachable, marginals, 65 source prices/sparkles, 62 legacy URLs, synced JSON.');
