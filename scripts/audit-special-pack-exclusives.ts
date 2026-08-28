import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import simulationModelDefault from '../frontend/lib/simulation/model.ts';
import type { Card, PackResult, SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const {
  MEGA_DREAM_GOD_PACK_PACK_RATE,
  MEGA_DREAM_GOD_PACK_RATE,
} = simulationModelDefault as unknown as typeof import('../frontend/lib/simulation/model.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SET_CODE = 's12a-vstar-universe';
const MEGA_DREAM_SET_CODE = 'm-dream-ex';
const AR9_NUMBERS = [201, 202, 203, 204, 205, 206, 207, 208, 209] as const;
const AR9_NUMBER_SET = new Set<number>(AR9_NUMBERS);
const DEFAULT_BOX_TRIALS = 5000;
const DEFAULT_PACK_TRIALS = 25000;

interface SpecialPackEvidence {
  kind: string;
  composition: Record<string, number>;
  observed_count: number;
  sample_boxes: number;
  sample_packs: number;
  box_rate: number;
  pack_rate: number;
  _source: string;
  _estimated_at: string;
}

interface SetWithSpecialPackEvidence extends SetMeta {
  box_guarantees?: {
    special_pack_evidence?: SpecialPackEvidence;
  };
}

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  const inline = process.argv.find((arg) => arg.startsWith(name + '='));
  const raw = inline?.slice(name.length + 1) ?? (index >= 0 ? process.argv[index + 1] : undefined);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function loadSet(setCode = SET_CODE): SetMeta {
  const path = resolve(ROOT_DIR, 'frontend', 'public', 'sets', setCode + '.json');
  return JSON.parse(readFileSync(path, 'utf8')) as SetMeta;
}

function assertSetMetadata(set: SetMeta): void {
  const arCards = set.cards.filter((card) => card.rarity === 'AR');
  const ar9Cards = arCards.filter((card) => AR9_NUMBER_SET.has(card.number));
  const regularArCards = arCards.filter((card) => !AR9_NUMBER_SET.has(card.number));
  const missingAr9 = AR9_NUMBERS.filter((number) => !ar9Cards.some((card) => card.number === number));

  if (missingAr9.length > 0) {
    throw new Error('VSTAR Universe AR9 metadata is missing card number(s): ' + missingAr9.join(', '));
  }
  if (regularArCards.length !== 28) {
    throw new Error('Expected 28 regular VSTAR Universe AR cards, found ' + regularArCards.length + '.');
  }
  for (const number of [183, 195]) {
    if (!regularArCards.some((card) => card.number === number)) {
      throw new Error('Regular VSTAR Universe AR #' + number + ' was incorrectly excluded.');
    }
  }
}

function ar9Cards(cards: Card[]): Card[] {
  return cards.filter((card) => AR9_NUMBER_SET.has(card.number));
}

function assertExclusiveCardsOnlyAppearAsAr9Pack(packs: PackResult[], openingLabel: string): boolean {
  const perPack = packs.map((pack) => ar9Cards(pack.cards));
  const nonEmptyPacks = perPack.filter((cards) => cards.length > 0);
  if (nonEmptyPacks.length === 0) return false;

  const cards = nonEmptyPacks.flat();
  const numbers = new Set(cards.map((card) => card.number));
  const isCompleteAr9Pack =
    nonEmptyPacks.length === 1
    && cards.length === AR9_NUMBERS.length
    && numbers.size === AR9_NUMBERS.length
    && AR9_NUMBERS.every((number) => numbers.has(number));

  if (!isCompleteAr9Pack) {
    const detail = nonEmptyPacks
      .map((packCards) => '[' + packCards.map((card) => card.number).join(',') + ']')
      .join(' ');
    throw new Error(openingLabel + ': AR9-exclusive cards leaked outside the fixed AR9 pack: ' + detail);
  }

  return true;
}

function assertCardsBelongToSet(
  cards: Card[],
  allowedCardNums: Set<string>,
  openingLabel: string,
  setCode = SET_CODE,
): void {
  const foreignCards = cards.filter((card) => !allowedCardNums.has(card.card_num));
  if (foreignCards.length > 0) {
    throw new Error(
      openingLabel + ': simulator returned card(s) outside ' + setCode + ': '
      + foreignCards.map((card) => card.card_num + '/' + card.name_ko).join(', '),
    );
  }
}

function rarityCounts(pack: PackResult): Record<string, number> {
  return pack.cards.reduce<Record<string, number>>((counts, card) => {
    if (card.rarity) counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    return counts;
  }, {});
}

function assertMegaDreamGodPackShape(packs: PackResult[], openingLabel: string): boolean {
  const candidates = packs.filter((pack) => (rarityCounts(pack).MA ?? 0) >= 2);
  if (candidates.length === 0) return false;
  if (candidates.length > 1) {
    throw new Error(openingLabel + ': more than one MEGA Dream ex god pack appeared in one opening.');
  }

  const pack = candidates[0];
  const counts = rarityCounts(pack);
  const uniqueCardNums = new Set(pack.cards.map((card) => card.card_num));
  const isExpectedShape =
    pack.cards.length === 10
    && counts.AR === 1
    && counts.MA === 5
    && counts.SAR === 4
    && uniqueCardNums.size === 10;

  if (!isExpectedShape) {
    throw new Error(
      openingLabel + ': malformed MEGA Dream ex god pack: '
      + JSON.stringify(counts) + ', unique=' + uniqueCardNums.size,
    );
  }

  return true;
}

function assertObservedRate(
  label: string,
  observed: number,
  trials: number,
  probability: number,
): void {
  const expected = trials * probability;
  const sigma = Math.sqrt(trials * probability * (1 - probability));
  const tolerance = Math.max(5, sigma * 5);
  if (Math.abs(observed - expected) > tolerance) {
    throw new Error(
      label + ': observed ' + observed + '/' + trials
      + ', expected about ' + expected.toFixed(1) + ' (5σ tolerance ' + tolerance.toFixed(1) + ').',
    );
  }
}

function assertMegaDreamEvidence(set: SetMeta): void {
  const evidence = (set as SetWithSpecialPackEvidence).box_guarantees?.special_pack_evidence;
  if (!evidence) throw new Error('MEGA Dream ex: special_pack_evidence is missing.');

  const expectedComposition = { AR: 1, MA: 5, SAR: 4 };
  if (JSON.stringify(evidence.composition) !== JSON.stringify(expectedComposition)) {
    throw new Error('MEGA Dream ex: evidence composition does not match AR1+MA5+SAR4.');
  }
  if (
    evidence.observed_count !== 14
    || evidence.sample_boxes !== 1000
    || evidence.sample_packs !== 10000
    || evidence.box_rate !== MEGA_DREAM_GOD_PACK_RATE
    || evidence.pack_rate !== MEGA_DREAM_GOD_PACK_PACK_RATE
  ) {
    throw new Error('MEGA Dream ex: source evidence and simulation constants are out of sync.');
  }
}

function main(): void {
  const set = loadSet();
  const megaDreamSet = loadSet(MEGA_DREAM_SET_CODE);
  const boxTrials = argNumber('--boxes', DEFAULT_BOX_TRIALS);
  const packTrials = argNumber('--packs', DEFAULT_PACK_TRIALS);
  const allowedCardNums = new Set(set.cards.map((card) => card.card_num));
  const megaDreamAllowedCardNums = new Set(megaDreamSet.cards.map((card) => card.card_num));

  assertSetMetadata(set);
  assertMegaDreamEvidence(megaDreamSet);

  let ar9Boxes = 0;
  for (let trial = 0; trial < boxTrials; trial++) {
    const result = simulateBox(
      set.cards,
      set.box_size,
      set.type,
      set.pack_size,
      'special-pack-audit:' + SET_CODE + ':box:' + trial,
      set.code,
    );
    const cards = result.packs.flatMap((pack) => pack.cards);
    assertCardsBelongToSet(cards, allowedCardNums, 'box ' + (trial + 1));
    if (assertExclusiveCardsOnlyAppearAsAr9Pack(result.packs, 'box ' + (trial + 1))) ar9Boxes += 1;
  }

  let ar9Packs = 0;
  for (let trial = 0; trial < packTrials; trial++) {
    const result = simulatePack(
      set.cards,
      set.type,
      set.pack_size,
      'special-pack-audit:' + SET_CODE + ':pack:' + trial,
      set.code,
    );
    assertCardsBelongToSet(result.pack.cards, allowedCardNums, 'single pack ' + (trial + 1));
    if (assertExclusiveCardsOnlyAppearAsAr9Pack([result.pack], 'single pack ' + (trial + 1))) ar9Packs += 1;
  }

  let megaDreamGodPackBoxes = 0;
  for (let trial = 0; trial < boxTrials; trial++) {
    const result = simulateBox(
      megaDreamSet.cards,
      megaDreamSet.box_size,
      megaDreamSet.type,
      megaDreamSet.pack_size,
      'special-pack-audit:' + MEGA_DREAM_SET_CODE + ':box:' + trial,
      megaDreamSet.code,
    );
    const cards = result.packs.flatMap((pack) => pack.cards);
    assertCardsBelongToSet(
      cards,
      megaDreamAllowedCardNums,
      'MEGA Dream ex box ' + (trial + 1),
      MEGA_DREAM_SET_CODE,
    );
    if (assertMegaDreamGodPackShape(result.packs, 'MEGA Dream ex box ' + (trial + 1))) {
      megaDreamGodPackBoxes += 1;
    }
  }

  let megaDreamGodPacks = 0;
  for (let trial = 0; trial < packTrials; trial++) {
    const result = simulatePack(
      megaDreamSet.cards,
      megaDreamSet.type,
      megaDreamSet.pack_size,
      'special-pack-audit:' + MEGA_DREAM_SET_CODE + ':pack:' + trial,
      megaDreamSet.code,
    );
    assertCardsBelongToSet(
      result.pack.cards,
      megaDreamAllowedCardNums,
      'MEGA Dream ex single pack ' + (trial + 1),
      MEGA_DREAM_SET_CODE,
    );
    if (assertMegaDreamGodPackShape([result.pack], 'MEGA Dream ex single pack ' + (trial + 1))) {
      megaDreamGodPacks += 1;
    }
  }

  assertObservedRate(
    'MEGA Dream ex boxes',
    megaDreamGodPackBoxes,
    boxTrials,
    MEGA_DREAM_GOD_PACK_RATE,
  );
  assertObservedRate(
    'MEGA Dream ex single packs',
    megaDreamGodPacks,
    packTrials,
    MEGA_DREAM_GOD_PACK_PACK_RATE,
  );

  console.log('VSTAR Universe special-pack audit passed.');
  console.log('- regular AR: 28 cards (including #183 Mew and #195 Latias)');
  console.log('- AR9 exclusive: #201-209, fixed nine-card pack only');
  console.log('- boxes: ' + boxTrials.toLocaleString() + ' trials, ' + ar9Boxes.toLocaleString() + ' AR9 boxes');
  console.log('- single packs: ' + packTrials.toLocaleString() + ' trials, ' + ar9Packs.toLocaleString() + ' AR9 packs');
  console.log('MEGA Dream ex special-pack audit passed.');
  console.log('- fixed shape: AR 1 + MA 5 + SAR 4, no duplicate card_num');
  console.log('- boxes: ' + boxTrials.toLocaleString() + ' trials, ' + megaDreamGodPackBoxes.toLocaleString() + ' god-pack boxes');
  console.log('- single packs: ' + packTrials.toLocaleString() + ' trials, ' + megaDreamGodPacks.toLocaleString() + ' god packs');
}

main();
