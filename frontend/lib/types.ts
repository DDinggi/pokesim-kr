export interface Card {
  card_num: string;
  number: number;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
  subtype: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
}

export interface StartDeckMeta {
  deck_count: number;
  special_deck_no: number;
  special_deck_rate: number;
  gold_deck_no?: number;
  gold_deck_rate?: number;
  rep_card_nums: string[];
  special_rep_card_nums: string[];
  gold_rep_card_nums?: string[];
}

export interface SetMeta {
  code: string;
  name_ko: string;
  type: string;
  box_size: number;
  pack_size: number;
  box_price_krw: number;
  pack_price_krw: number;
  cards: Card[];
  /** type === 'starter' (스타트 덱 100) 전용 메타. 덱 뽑기 시뮬에서만 사용. */
  start_deck?: StartDeckMeta;
}

export interface PackResult {
  cards: Card[];
}

export interface BoxResult {
  packs: PackResult[];
  summary: Record<string, number>;
  seed: string;
}
