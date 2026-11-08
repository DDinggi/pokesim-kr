/** Regression samples test the implementation, not real-world pull rates. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import simulatorDefault from '../frontend/lib/simulator.ts';
import rarityDefault from '../frontend/lib/rarity.ts';
import newSetsDefault from '../frontend/lib/newSets.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { premiumSparkleVariant, premiumPriceSparkleVariant } = rarityDefault as unknown as typeof import('../frontend/lib/rarity.ts');
const { NEW_SIM_SET_CODES } = newSetsDefault as unknown as typeof import('../frontend/lib/newSets.ts');
const root = resolve(import.meta.dirname, '..');
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
  let high = 0, rr = 0, rare = 0;
  const boxGroups = { normal: 0, mega: 0, break: 0 }, packGroups = { normal: 0, mega: 0, break: 0 };
  for (let i = 0; i < 4000; i++) {
    const seed = `xy-next-three-box-${code}-${i}`;
    const box = simulateBox(set.cards, 30, set.type, 5, seed, code);
    assert.equal(box.packs.length, 30);
    const cards = box.packs.flatMap(p => { assert.equal(p.cards.length, 5); return p.cards; });
    const highCount = cards.filter(c => ['SR', 'UR'].includes(c.rarity ?? '')).length;
    assert.ok(highCount <= 1);
    assert.equal(cards.filter(c => ['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')).length, 15);
    high += highCount;
    const rrs = cards.filter(c => c.rarity === 'RR'); rr += rrs.length;
    if (index > 0) {
      const groups = { normal: 0, mega: 0, break: 0 };
      for (const c of rrs) { groups[category(c.name_ko!) ]++; boxGroups[category(c.name_ko!)]++; }
      assert.equal(groups.normal, 3);
      assert.equal(groups.mega + groups.break, 3);
      assert.ok(groups.break === 1 || groups.break === 2);
      assert.equal(new Set(rrs.filter(c => category(c.name_ko!) === 'break').map(c => c.card_num)).size, groups.break);
    } else assert.ok(rrs.length === 4 || rrs.length === 5);
    cards.forEach(c => seenBox.add(c.card_num));
    if (i < 3) assert.deepEqual(box, simulateBox(set.cards, 30, set.type, 5, seed, code));
  }
  close(high / 4000, .75, .035); close(rr / 4000, index === 0 ? 4.5 : 6, .04);
  for (let i = 0; i < 60000; i++) {
    const { pack } = simulatePack(set.cards, set.type, 5, `xy-next-three-pack-${code}-${i}`, code);
    assert.equal(pack.cards.length, 5);
    assert.ok(pack.cards.filter(c => ['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')).length <= 1);
    for (const c of pack.cards) {
      seenPack.add(c.card_num);
      if (['R', 'RR', 'SR', 'UR'].includes(c.rarity ?? '')) rare++;
      if (c.rarity === 'RR') packGroups[category(c.name_ko!)]++;
    }
  }
  close(rare / 60000, .5, .012);
  if (index > 0) for (const [group, expected] of Object.entries({ normal: 3, mega: 1.5, break: 1.5 })) {
    close(boxGroups[group as keyof typeof boxGroups] / 4000, expected, .04);
    close(packGroups[group as keyof typeof packGroups] / 60000 * 30, expected, .1);
  }
  for (const c of set.cards) {
    assert.ok(seenBox.has(c.card_num), `unreachable box ${c.card_num}`);
    assert.ok(seenPack.has(c.card_num), `unreachable pack ${c.card_num}`);
    assert.equal(premiumSparkleVariant(c.rarity, c), premiumPriceSparkleVariant(c), `${c.card_num}: rarity glow bypassed price`);
  }
  console.log(`${code}: ${set.cards.length} cards, 4,000 boxes / 60,000 packs, full reachability, expected counts, replay and price effects passed`);
}
