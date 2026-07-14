import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { Card, PackResult, SetMeta } from '../frontend/lib/types.ts';

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SET_CODE = 's12a-vstar-universe';
const AR9_NUMBERS = [201, 202, 203, 204, 205, 206, 207, 208, 209] as const;
const AR9_NUMBER_SET = new Set<number>(AR9_NUMBERS);
const DEFAULT_BOX_TRIALS = 5000;
const DEFAULT_PACK_TRIALS = 25000;

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  const inline = process.argv.find((arg) => arg.startsWith(name + '='));
  const raw = inline?.slice(name.length + 1) ?? (index >= 0 ? process.argv[index + 1] : undefined);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function loadSet(): SetMeta {
  const path = resolve(ROOT_DIR, 'frontend', 'public', 'sets', SET_CODE + '.json');
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

function assertCardsBelongToSet(cards: Card[], allowedCardNums: Set<string>, openingLabel: string): void {
  const foreignCards = cards.filter((card) => !allowedCardNums.has(card.card_num));
  if (foreignCards.length > 0) {
    throw new Error(
      openingLabel + ': simulator returned card(s) outside ' + SET_CODE + ': '
      + foreignCards.map((card) => card.card_num + '/' + card.name_ko).join(', '),
    );
  }
}

function main(): void {
  const set = loadSet();
  const boxTrials = argNumber('--boxes', DEFAULT_BOX_TRIALS);
  const packTrials = argNumber('--packs', DEFAULT_PACK_TRIALS);
  const allowedCardNums = new Set(set.cards.map((card) => card.card_num));

  assertSetMetadata(set);

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

  console.log('VSTAR Universe special-pack audit passed.');
  console.log('- regular AR: 28 cards (including #183 Mew and #195 Latias)');
  console.log('- AR9 exclusive: #201-209, fixed nine-card pack only');
  console.log('- boxes: ' + boxTrials.toLocaleString() + ' trials, ' + ar9Boxes.toLocaleString() + ' AR9 boxes');
  console.log('- single packs: ' + packTrials.toLocaleString() + ' trials, ' + ar9Packs.toLocaleString() + ' AR9 packs');
}

main();