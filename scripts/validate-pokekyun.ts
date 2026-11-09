/** Implementation regression only; generated trials are not real opening evidence. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import luckDefault from '../frontend/lib/luck.ts';
import modelDefault from '../frontend/lib/simulation/model.ts';
import newSetsDefault from '../frontend/lib/newSets.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { summarizeLuckEvent } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const { POKEKYUN_BOX_RR_COUNTS, POKEKYUN_RR_PER_BOX, POKEKYUN_RR_PER_PACK } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const { NEW_SIM_SET_CODES, sortNewSimSetsFirst } = newSetsDefault as unknown as typeof import('../frontend/lib/newSets.ts');
const { premiumSparkleVariant, premiumPriceSparkleVariant } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const root = resolve(import.meta.dirname, '..'), code = 'cp3-pokekyun-collection';
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const source = read(`data/sets/${code}.json`);
const set = JSON.parse(source) as SetMeta;
const evidence = JSON.parse(read('data/manual/cp3-pokekyun-opening-evidence-20261108.json'));
const close = (a: number, b: number, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
assert.equal(source, read(`frontend/public/sets/${code}.json`));
const followup = JSON.parse(read('data/manual/cp3-pokekyun-opening-followup-20261109.json'));
const bulk = JSON.parse(read('data/manual/new-four-jp-bulk-opening-evidence-20261109.json'));
const jpBoxes = [...evidence.boxes, ...followup.additional_boxes, ...bulk.cp3.additional_boxes].filter(box => box.region === 'JP');
assert.equal(jpBoxes.length, 16);
assert.equal(jpBoxes.reduce((n, box) => n + box.rr_count, 0), 78);
assert.deepEqual(jpBoxes.map(box => box.rr_count), [...POKEKYUN_BOX_RR_COUNTS]);
assert.equal(set.box_size, 20); assert.equal(set.pack_size, 5);
assert.equal(evidence.boxes.length, 10);
assert.equal(evidence.boxes.reduce((n: number, box: { pack_count: number }) => n + box.pack_count, 0), 200);
assert.equal(evidence.boxes.reduce((n: number, box: { rr_count: number }) => n + box.rr_count, 0), 47);
for (const box of evidence.boxes) {
  assert.equal(box.rr_numbers.length, box.rr_count);
  assert.equal(new Set(box.rr_numbers).size, box.rr_count);
  if (box.counts_by_number_1_to_32) {
    const counts: number[] = box.counts_by_number_1_to_32;
    assert.equal(counts.reduce((a, b) => a + b, 0), 80);
    assert.equal(counts.reduce((n, count, index) => n + (set.cards[index].rarity === 'C' ? count : 0), 0), 40);
    assert.equal(counts.reduce((n, count, index) => n + (set.cards[index].rarity === 'RR' ? count : 0), 0), box.rr_count);
  }
}
close(POKEKYUN_RR_PER_BOX, 4.875); close(POKEKYUN_RR_PER_PACK, .24375);
assert.equal(set.cards.length, 32);
assert.deepEqual(set.cards.filter(c => c.rarity === 'RR').map(c => c.number), [6, 7, 10, 19, 20, 25, 26]);
assert.equal(set.cards.filter(c => c.rarity === 'C').length, 13);
assert.equal(set.cards.filter(c => c.rarity === 'U').length, 12);
assert.ok(set.cards.every(c => /^BS20160030\d{2}$/.test(c.card_num)));
assert.equal(set.cards.filter(c => c.price_confidence === 'source').length, 9);
assert.equal(set.cards.find(c => c.number === 26)?.price_ref_krw, undefined);
assert.ok(JSON.parse(source).cards.find((c: { number: number }) => c.number === 26)._price_reference_exclusion);
assert.ok(JSON.parse(read('data/sets-index.json')).active_sets.includes(code));
assert.ok(read('frontend/app/page.tsx').includes('  cp3PokekyunCollection,'));
assert.ok(NEW_SIM_SET_CODES.includes(code));
assert.deepEqual(sortNewSimSetsFirst([{ code: 's8a-25th-anniversary' }, { code: 'xy6-emerald-break' }, { code: 'xy7-bandit-ring' }, { code }]).map(s => s.code), ['xy7-bandit-ring', code, 's8a-25th-anniversary', 'xy6-emerald-break']);
assert.ok(existsSync(resolve(root, `frontend/public/boxes/thumbs/${code}.webp`)));
const counts: Record<number, number> = { 4: 0, 5: 0, 6: 0 }, seen = new Set<string>(), seenPack = new Set<string>();
let hasPikachu = 0, rrPackCount = 0;
const perCard: Record<string, number> = {};
for (let i = 0; i < 10000; i++) {
  const seed = `cp3-box-${i}`;
  const box = simulateBox(set.cards, 20, set.type, 5, seed, code);
  assert.equal(box.packs.length, 20);
  for (const pack of box.packs) {
    assert.equal(pack.cards.length, 5);
    assert.equal(new Set(pack.cards.map(c => c.card_num)).size, 5);
    assert.equal(pack.cards.filter(c => c.rarity === 'C').length, 3);
    assert.ok(pack.cards.filter(c => c.rarity === 'RR').length <= 1);
    pack.cards.forEach(c => seen.add(c.card_num));
  }
  const rr = box.packs.flatMap(p => p.cards).filter(c => c.rarity === 'RR');
  assert.ok(rr.length >= 4 && rr.length <= 6); counts[rr.length]++;
  assert.equal(new Set(rr.map(c => c.card_num)).size, rr.length);
  hasPikachu += Number(rr.some(c => c.number === 10));
  rr.forEach(c => perCard[c.card_num] = (perCard[c.card_num] ?? 0) + 1);
  if (i < 3) assert.deepEqual(box, simulateBox(set.cards, 20, set.type, 5, seed, code));
  if (i < 30) {
    const summary = summarizeLuckEvent(box.packs.flatMap(p => p.cards), { setCode: code, boxes: 1, packs: 0, boxSize: 20, topPerBox: 0, sarPerBox: 0 }, set);
    close(summary.observedScore!, rr.length - 4); close(summary.expectedScore!, .875);
    const expected = [{ score: 0, probability: .25 }, { score: 1, probability: .625 }, { score: 2, probability: .125 }];
    assert.equal(summary.scoreDistribution?.length, 3);
    summary.scoreDistribution!.forEach((entry, n) => { close(entry.score, expected[n].score); close(entry.probability, expected[n].probability); });
  }
}
close(counts[4] / 10000, .25, .02); close(counts[5] / 10000, .625, .02); close(counts[6] / 10000, .125, .02);
assert.ok(hasPikachu > 0 && hasPikachu < 10000);
for (const n of Object.values(perCard)) close(n / 10000, 4.875 / 7, .025);
for (let i = 0; i < 100000; i++) {
  const { pack } = simulatePack(set.cards, set.type, 5, `cp3-pack-${i}`, code);
  assert.equal(pack.cards.length, 5);
  const rr = pack.cards.filter(c => c.rarity === 'RR').length;
  assert.ok(rr <= 1); rrPackCount += rr; pack.cards.forEach(c => seenPack.add(c.card_num));
}
close(rrPackCount / 100000, .24375, .007);
const noRR = set.cards.filter(c => c.rarity === 'C').slice(0, 5);
const packSummary = summarizeLuckEvent(noRR, { setCode: code, boxes: 0, packs: 1, boxSize: 20, topPerBox: 0, sarPerBox: 0 }, set);
close(packSummary.expectedScore!, .24375); close(packSummary.observedScore!, 0);
for (const c of set.cards) {
  assert.ok(seen.has(c.card_num) && seenPack.has(c.card_num), `Unreachable ${c.card_num}`);
  assert.equal(premiumSparkleVariant(c.rarity, c), premiumPriceSparkleVariant(c));
}
console.log(JSON.stringify({ evidence_jp_boxes: 16, evidence_jp_packs: 320, regression_boxes: 10000, regression_packs: 100000, counts, rrPackRate: rrPackCount / 100000, pikachuBoxes: hasPikachu, status: 'passed' }));
