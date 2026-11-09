/** Regression samples test the implementation, not real-world pull rates. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import newSetsDefault from '../frontend/lib/newSets.ts';
import modelDefault from '../frontend/lib/simulation/model.ts';
import luckDefault from '../frontend/lib/luck.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { premiumSparkleVariant, premiumPriceSparkleVariant } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const { NEW_SIM_SET_CODES } = newSetsDefault as unknown as typeof import('../frontend/lib/newSets.ts');
const { getStandardSvSetRate, getStandardHighMean, getStandardRrMean } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const { summarizeLuckEvent } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const root = resolve(import.meta.dirname, '..');
const bulk = JSON.parse(readFileSync(resolve(root, 'data/manual/new-four-jp-bulk-opening-evidence-20261109.json'), 'utf8'));
const codes = ['xy7-bandit-ring', 'xy8-blue-shock', 'xy8-red-flash'];
const close = (a: number, b: number, tolerance: number) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b} +/- ${tolerance}`);
const category = (name: string) => name.includes('BREAK') ? 'break' : name.startsWith('M') ? 'mega' : 'normal';
for (const [index, code] of codes.entries()) {
  const source = readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8');
  assert.equal(source, readFileSync(resolve(root, `frontend/public/sets/${code}.json`), 'utf8'));
  const set = JSON.parse(source) as SetMeta;
  const corrected = index === 1
    ? { BS2015006055: 56, BS2015006056: 55 }
    : index === 2 ? { BS2015007056: 57, BS2015007057: 56 } : {};
  for (const [id, number] of Object.entries(corrected)) assert.equal(set.cards.find(c => c.card_num === id)?.number, number, `${id}: printed number regressed`);
  if (index > 0) {
    const mewtwo = set.cards.find(c => c.number === 62)!;
    assert.ok(mewtwo.price_source?.includes(index === 1 ? '/000000016657/xy08-01/' : '/000000016722/xy08-02/'), `${code}: price belongs to another XY8 edition`);
  }
  assert.equal(set.cards.length, index === 0 ? 97 : 65);
  assert.equal(new Set(set.cards.map(c => c.card_num)).size, set.cards.length);
  assert.ok(NEW_SIM_SET_CODES.includes(code as never));
  const seenBox = new Set<string>(), seenPack = new Set<string>();
  assert.equal(set.box_size, 30); assert.equal(set.pack_size, 5);
  const rate = getStandardSvSetRate(code)!;
  const review = JSON.parse(source).box_guarantees.pull_rate_review;
  assert.equal(review.sample.high_boxes, [87, 30, 32][index]);
  assert.equal(review.official_product_check.box_packs, 30);
  rate.rrCountDistribution!.forEach((p, count) => close(p, review.assumptions.rr_count_probabilities[count], 1e-12));
  const expectedSr = [39 / 87, 8 / 30, 12 / 32][index];
  const expectedUr = [46 / 87, 4 / 30, 4 / 32][index];
  const expectedRr = [146 / 48, 47 / 11, 90 / 21][index];
  const records: Array<{ box_count: number; sr_count: number; ur_count: number; rr_count: number | null; set_code?: string }> = index === 0
    ? bulk.xy7.records : bulk.xy8.records.filter((r: { set_code: string }) => r.set_code === code);
  const boxes = records.reduce((n, r) => n + r.box_count, 0);
  close(records.reduce((n, r) => n + r.sr_count, 0) / boxes, expectedSr, 1e-10);
  close(records.reduce((n, r) => n + r.ur_count, 0) / boxes, expectedUr, 1e-10);
  const rrRecords = records.filter(r => r.rr_count !== null);
  close(rrRecords.reduce((n, r) => n + r.rr_count!, 0) / rrRecords.reduce((n, r) => n + r.box_count, 0), expectedRr, 1e-10);
  close(getStandardHighMean(rate), expectedSr + expectedUr, 1e-10);
  close(getStandardRrMean(rate), expectedRr, 1e-10);
  for (const probabilities of [rate.highCountDistribution, rate.rrCountDistribution]) if (probabilities) {
    close(probabilities.reduce((a, b) => a + b, 0), 1, 1e-10);
    assert.ok(probabilities.every(p => p >= 0 && p <= 1));
  }
  let high = 0, rr = 0, rare = 0, sr = 0, ur = 0, packSr = 0, packUr = 0, packRr = 0;
  let observedScore = 0, expectedScore = 0;
  const highHistogram = [0, 0, 0], rrCounts = new Set<number>();
  const boxGroups = { normal: 0, mega: 0, break: 0 }, packGroups = { normal: 0, mega: 0, break: 0 };
  for (let i = 0; i < 4000; i++) {
    const seed = `xy-next-three-box-${code}-${i}`;
    const box = simulateBox(set.cards, 30, set.type, 5, seed, code);
    assert.equal(box.packs.length, 30);
    const cards = box.packs.flatMap(p => { assert.equal(p.cards.length, 5); return p.cards; });
    const highCount = cards.filter(c => ['SR', 'UR'].includes(c.rarity ?? '')).length;
    assert.ok(highCount <= (index === 0 ? 2 : 1));
    highHistogram[highCount]++;
    assert.equal(cards.filter(c => ['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')).length, 15);
    high += highCount;
    sr += cards.filter(c => c.rarity === 'SR').length;
    ur += cards.filter(c => c.rarity === 'UR').length;
    const summary = summarizeLuckEvent(cards, { setCode: code, boxes: 1, packs: 0, boxSize: 30, topPerBox: 0, sarPerBox: 0 }, set);
    observedScore += summary.observedScore!; expectedScore += summary.expectedScore!;
    if (i === 0) {
      close(summary.scoreDistribution!.reduce((n, v) => n + v.probability, 0), 1, 1e-9);
      close(summary.scoreDistribution!.reduce((n, v) => n + v.score * v.probability, 0), summary.expectedScore!, 1e-8);
    }
    const rrs = cards.filter(c => c.rarity === 'RR'); rr += rrs.length; rrCounts.add(rrs.length);
    if (index > 0) {
      const groups = { normal: 0, mega: 0, break: 0 };
      for (const c of rrs) { groups[category(c.name_ko!) ]++; boxGroups[category(c.name_ko!)]++; }
      assert.ok(groups.normal >= 1 && groups.normal <= 2);
      assert.ok(groups.mega >= 1 && groups.mega <= 2);
      assert.equal(groups.normal + groups.mega + groups.break, rrs.length);
      assert.ok(groups.break === 1 || groups.break === 2);
      assert.equal(new Set(rrs.filter(c => category(c.name_ko!) === 'break').map(c => c.card_num)).size, groups.break);
    }
    assert.ok(rrs.length >= 3 && rrs.length <= 5);
    cards.forEach(c => seenBox.add(c.card_num));
    if (i < 3) assert.deepEqual(box, simulateBox(set.cards, 30, set.type, 5, seed, code));
  }
  close(high / 4000, expectedSr + expectedUr, .05); close(rr / 4000, expectedRr, .05);
  close(sr / 4000, expectedSr, .04); close(ur / 4000, expectedUr, .04);
  close(observedScore / 4000, expectedScore / 4000, .1);
  assert.deepEqual([...rrCounts].sort(), [3, 4, 5]);
  if (index === 0) { close(highHistogram[0] / 4000, .1, .02); close(highHistogram[2] / 4000, 85 / 87 - .9, .02); }
  for (let i = 0; i < 60000; i++) {
    const { pack } = simulatePack(set.cards, set.type, 5, `xy-next-three-pack-${code}-${i}`, code);
    assert.equal(pack.cards.length, 5);
    assert.ok(pack.cards.filter(c => ['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')).length <= 1);
    for (const c of pack.cards) {
      seenPack.add(c.card_num);
      if (['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')) rare++;
      if (c.rarity === 'RR') { packGroups[category(c.name_ko!)]++; packRr++; }
      if (c.rarity === 'SR') packSr++;
      if (c.rarity === 'UR') packUr++;
    }
  }
  close(rare / 60000, .5, .012);
  close(packSr / 60000 * 30, expectedSr, .07);
  close(packUr / 60000 * 30, expectedUr, .07);
  close(packRr / 60000 * 30, expectedRr, .15);
  if (index > 0) for (const group of ['normal', 'mega', 'break'] as const) {
    close(packGroups[group] / 60000 * 30, boxGroups[group] / 4000, .15);
  }
  console.log({ code, srPerBox: sr / 4000, urPerBox: ur / 4000, rrPerBox: rr / 4000, highHistogram, boxGroups, packGroups });
  for (const c of set.cards) {
    assert.ok(seenBox.has(c.card_num), `unreachable box ${c.card_num}`);
    assert.ok(seenPack.has(c.card_num), `unreachable pack ${c.card_num}`);
    assert.equal(premiumSparkleVariant(c.rarity, c), premiumPriceSparkleVariant(c), `${c.card_num}: rarity glow bypassed price`);
  }
  console.log(`${code}: ${set.cards.length} cards, 4,000 boxes / 60,000 packs, full reachability, expected counts, replay and price effects passed`);
}
