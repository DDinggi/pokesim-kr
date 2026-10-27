import type { SetMeta } from './types';
import { ANNIVERSARY_25_SET_CODE } from './simulation/model';
import specialProduct from '../public/products/s8a-25th-anniversary-special.json';

export const ANNIVERSARY_25_SPECIAL_CODE = 's8a-25th-anniversary-special';

/** Official Korean vending SKU: four loose boosters and one separate promo pack.
 * Reuses the original collection; this is not another card set or hit dex.
 * Source: https://pokemoncard.co.kr/card/386
 */
export function getAnniversary25SpecialSet(sets: SetMeta[]): SetMeta | null {
  const main = sets.find(set => set.code === ANNIVERSARY_25_SET_CODE);
  if (!main) return null;
  const promo: SetMeta = {
    ...main,
    type: 'anniversary-promo',
    name_ko: '25주년 프로모팩',
    box_size: 1,
    pack_size: 1,
    bonus_pack_count: 0,
    box_price_krw: 0,
    pack_price_krw: 0,
    cards: main.cards.filter(card => card.rarity === 'S8AP'),
    luck_value_ref: null,
  };
  return {
    code: ANNIVERSARY_25_SPECIAL_CODE,
    name_ko: '25주년 스페셜 세트 (본팩 4 + 프로모 1)',
    series: main.series,
    type: 'bundle',
    box_size: 5,
    pack_size: 0,
    box_price_krw: 10000,
    pack_price_krw: 0,
    cards: main.cards,
    luck_value_ref: specialProduct.luck_value_ref,
    resolved_bundle_components: [{ set: main, pack_count: 4 }, { set: promo, pack_count: 1 }],
  };
}

export function getAnniversary25RecordSets(sets: SetMeta[]): SetMeta[] {
  const special = getAnniversary25SpecialSet(sets);
  return special && !sets.some(set => set.code === special.code) ? [...sets, special] : sets;
}

export function isAnniversary25Special(set: Pick<SetMeta, 'code'>): boolean {
  return set.code === ANNIVERSARY_25_SPECIAL_CODE;
}
