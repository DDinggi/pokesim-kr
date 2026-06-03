import seedrandom from 'seedrandom';
import type { Card, StartDeckMeta } from '../types';

/**
 * 스타트 덱 100 (배틀 컬렉션) 시뮬.
 *
 * 박스/팩 봉입률 모델이 아니라 "101개 구축 덱 중 1개를 무작위로 받는" 제품이다.
 * - 일반 덱 1~100: 대표카드 1장
 * - 특수 덱(101번): 대표카드 3장 — special_deck_rate 확률로 등장
 *
 * 대표카드는 카드 풀에서 ex/메가 ex 카드를 추려 매핑한 추정치다(공식 덱 구성 비공개).
 */
export interface StartDeckResult {
  deckNo: number;
  isSpecial: boolean;
  isGold: boolean;
  variant: 'normal' | 'special' | 'gold';
  cards: Card[];
  seed: string;
}

export function simulateStartDeck(
  allCards: Card[],
  startDeck: StartDeckMeta,
  seedInput?: string,
): StartDeckResult {
  const seed = seedInput ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rng = seedrandom(seed);
  const byNum = new Map(allCards.map((card) => [card.card_num, card]));
  const resolve = (nums: string[]): Card[] =>
    nums.map((num) => byNum.get(num)).filter((card): card is Card => Boolean(card));

  const goldRate = startDeck.gold_deck_rate ?? 0;
  const goldRepCardNums = startDeck.gold_rep_card_nums ?? [];
  const roll = rng();

  if (goldRepCardNums.length > 0 && roll < goldRate) {
    return {
      deckNo: startDeck.gold_deck_no ?? 1,
      isSpecial: false,
      isGold: true,
      variant: 'gold',
      cards: resolve(goldRepCardNums),
      seed,
    };
  }

  const isSpecial = startDeck.rep_card_nums.length === 0 || roll < goldRate + startDeck.special_deck_rate;
  if (isSpecial) {
    return {
      deckNo: startDeck.special_deck_no,
      isSpecial: true,
      isGold: false,
      variant: 'special',
      cards: resolve(startDeck.special_rep_card_nums),
      seed,
    };
  }

  const reps = startDeck.rep_card_nums;
  const idx = Math.floor(rng() * reps.length);
  const card = byNum.get(reps[idx]);
  return {
    deckNo: idx + 1,
    isSpecial: false,
    isGold: false,
    variant: 'normal',
    cards: card ? [card] : [],
    seed,
  };
}
