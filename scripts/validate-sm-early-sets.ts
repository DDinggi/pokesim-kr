/** Regression checks for the six 2017 early SM products; not real pull-rate measurements. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from 'node-html-parser';
import simulatorDefault from '../frontend/lib/simulator.ts';
import modelDefault from '../frontend/lib/simulation/model.ts';
import luckDefault from '../frontend/lib/luck.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { getStandardSvSetRate } = modelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');
const { createLuckOpening, summarizeLuckRarityCounts } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const root = resolve(import.meta.dirname, '..');
const codes = ['sm2plus-new-trials', 'sm2k-alolan-sunlight', 'sm2l-alolan-moonlight', 'sm1plus-sun-moon', 'sm1s-sun-collection', 'sm1m-moon-collection'];
const corrections = JSON.parse(readFileSync(resolve(root, 'data/manual/sm-early-six-metadata-review.json'), 'utf8'));
const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
for (const code of codes) {
  const text = readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8');
  assert.equal(text, readFileSync(resolve(root, `frontend/public/sets/${code}.json`), 'utf8'), 'public must match SSOT');
  const set = JSON.parse(text) as SetMeta;
  const rate = getStandardSvSetRate(code)!;
  close(Object.values(rate.mandatoryHighWeights).reduce((sum, weight) => sum + weight, 0), 100);
  const highRate = rate.mandatoryHighRate!;
  const expectedRates = code === 'sm1plus-sun-moon' ? { SR: 1 / 4.5, HR: 1 / 6, UR: .1 } : { SR: .4, HR: .2, UR: .1 };
  for (const mode of ['box', 'pack'] as const) {
    const summary = summarizeLuckRarityCounts({}, createLuckOpening(set, mode === 'box' ? { boxes: 1 } : { packs: 1 }), set);
    for (const [rarity, probability] of Object.entries(expectedRates)) {
      const count = rarity === 'UR' ? (summary.expectedScoreCounts?.UR ?? 0) + (summary.expectedScoreCounts?.UR_LOW ?? 0) : summary.expectedScoreCounts?.[rarity] ?? 0;
      close(count, probability / (mode === 'box' ? 1 : set.box_size));
    }
    close(summary.scoreDistribution!.reduce((sum, row) => sum + row.probability, 0), 1);
    assert.ok(summary.scoreDistribution!.some(row => row.score === 0), 'no SR+ must be represented in luck');
  }
  const enhanced = set.pack_size === 8;
  const seenBox = new Set<string>(), seenPack = new Set<string>();
  const highCounts = { SR: 0, HR: 0, UR: 0 };
  const looseCounts = { SR: 0, HR: 0, UR: 0 };
  let none = 0;
  const checkPack = (cards: Card[], seen: Set<string>) => {
    assert.equal(cards.length, set.pack_size);
    for (const card of cards) seen.add(card.card_num);
    if (enhanced) {
      assert.equal(cards.filter(card => card.number == null && card.card_type === '에너지').length, 1, 'one basic energy');
      assert.equal(cards.filter(card => card.subtype === '미러' || card.rarity != null).length, 1, 'exactly one holo, replaced by GX/secret');
    }
  };
  for (let i = 0; i < 4000; i++) {
    const seed = `sm-early-regression-${i}`;
    const box = simulateBox(set.cards, set.box_size, set.type, set.pack_size, seed, code);
    assert.equal(box.packs.length, set.box_size);
    const highs = (box.summary.SR ?? 0) + (box.summary.HR ?? 0) + (box.summary.UR ?? 0);
    assert.ok(highs === 0 || highs === 1);
    if (highs === 0) none++;
    assert.ok(box.summary.RR >= 3 && box.summary.RR <= (code === 'sm2plus-new-trials' ? 3 : 4));
    for (const rarity of ['SR', 'HR', 'UR'] as const) highCounts[rarity] += box.summary[rarity] ?? 0;
    for (const pack of box.packs) checkPack(pack.cards, seenBox);
    if (i < 5) assert.deepEqual(box, simulateBox(set.cards, set.box_size, set.type, set.pack_size, seed, code), 'same seed');
  }
  for (let i = 0; i < 60000; i++) {
    const { pack } = simulatePack(set.cards, set.type, set.pack_size, `sm-early-loose-${i}`, code);
    checkPack(pack.cards, seenPack);
    for (const card of pack.cards) if (card.rarity && card.rarity in looseCounts) looseCounts[card.rarity as keyof typeof looseCounts]++;
  }
  for (const card of set.cards) {
    assert.ok(seenBox.has(card.card_num), `box unreachable ${card.card_num}`);
    assert.ok(seenPack.has(card.card_num), `loose pack unreachable ${card.card_num}`);
    assert.ok(card.price_confidence !== 'source' || (card.price_ref_krw ?? 0) > 0);
  }
  close(none / 4000, 1 - highRate, .035);
  for (const [rarity, probability] of Object.entries(expectedRates)) {
    close(highCounts[rarity as keyof typeof highCounts] / 4000, probability, .025);
    const expected = probability / set.box_size;
    const tolerance = Math.max(.001, 6 * Math.sqrt(expected * (1 - expected) / 60000));
    close(looseCounts[rarity as keyof typeof looseCounts] / 60000, expected, tolerance);
  }
  for (const correction of corrections.corrections.filter((entry: { set: string }) => entry.set === code)) {
    const card = set.cards.find(card => card.card_num === correction.card_num)!;
    assert.equal((card as unknown as Record<string, unknown>)[correction.field], correction.after);
  }
  for (const suffix of [`${code}.png`, `thumbs/${code}.webp`, `original/${code}.png`]) assert.ok(existsSync(resolve(root, `frontend/public/boxes/${suffix}`)));
  console.log(`${code}: ${set.cards.length} cards reached in box and loose packs; packing, seed, rate/luck alignment, metadata, public and boxes OK`);
}
console.log('Early SM six-set regression passed (4,000 boxes + 60,000 loose packs each).');

const reportPath = resolve(root, '.tmp/card-comparison/index.html');
if (process.argv.includes('--comparison')) {
  assert.ok(existsSync(reportPath), 'Run audit:comparison for all six sets first');
  const document = parse(readFileSync(reportPath, 'utf8'));
  const rows = document.querySelectorAll('.pair');
  assert.equal(rows.length, 509);
  for (const code of codes) {
    const set = JSON.parse(readFileSync(resolve(root, `data/sets/${code}.json`), 'utf8')) as SetMeta;
    const sorted = [...set.cards].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
    const pairs = document.querySelector(`#${code}`)!.querySelectorAll('.pair');
    assert.equal(pairs.length, set.cards.length);
    for (const [index, card] of sorted.entries()) {
      const cells = pairs[index].querySelectorAll('article');
      assert.equal(cells.length, 2);
      assert.ok(cells[0].text.includes(card.card_num));
      if (card.image_url.startsWith('wmimages/')) {
        assert.equal(cells[0].querySelector('img')!.getAttribute('src'), `https://img.pokesim.kr/cards/512/${card.image_url.replace(/\.[^.]+$/, '.webp')}`);
        assert.ok(cells[0].querySelector('a')!.getAttribute('href')!.endsWith(card.image_url));
      } else {
        assert.equal(cells[0].querySelector('img'), null, 'Japanese fallback must not be labeled as Korean');
      }
    }
  }
  // Execute the generated filter with a small DOM stub. This is a logic
  // regression, not a substitute for browser visual/interaction testing.
  const controls: Record<string, { checked: boolean; value: string; addEventListener: (event: string, listener: unknown) => void }> = {
    high: { checked: false, value: '', addEventListener() {} },
    search: { checked: false, value: '', addEventListener() {} },
  };
  const stubs = rows.map(row => ({ hidden: false, dataset: { high: row.getAttribute('data-high'), search: row.getAttribute('data-search') } }));
  const context = { document: { getElementById: (id: string) => controls[id], querySelectorAll: () => stubs } };
  runInNewContext(document.querySelector('script')!.text + ';filter();', context);
  assert.equal(stubs.filter(row => !row.hidden).length, 509);
  controls.high.checked = true;
  runInNewContext('filter()', context);
  assert.equal(stubs.filter(row => !row.hidden).length, 84);
  controls.search.value = '릴리에';
  runInNewContext('filter()', context);
  assert.equal(stubs.filter(row => !row.hidden).length, 1);
  assert.ok(stubs.find(row => !row.hidden)!.dataset.search!.includes('65 66'));
  console.log('Generated comparison HTML: 509 paired rows, country labels/original links, 84-card filter and Lillie KR65/JP66 search OK (DOM stub, not browser QA).');
} else console.log('Pass --comparison after audit:comparison to also check the generated six-set report.');
