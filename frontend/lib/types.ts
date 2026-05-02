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

export interface SetMeta {
  code: string;
  name_ko: string;
  type: string;
  box_size: number;
  pack_size: number;
  box_price_krw: number;
  pack_price_krw: number;
  cards: Card[];
}

export interface PackResult {
  cards: Card[];
}

export interface BoxResult {
  packs: PackResult[];
  summary: Record<string, number>;
  seed: string;
}
