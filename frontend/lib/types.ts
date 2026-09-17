export interface Card {
  card_num: string;
  number: number;
  collector_number?: string;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
  subtype: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
  price_ref_krw?: number | null;
  price_ref_jpy?: number | null;
  price_ref_usd?: number | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  price_confidence?: 'source' | 'proxy' | 'manual' | null;
  /** 혼합 상품에서 이 카드가 실제로 나온 원본 확장팩 코드. 런타임 기록용. */
  source_set_code?: string;
  /** 혼합 상품 단위 기록을 안전하게 지우기 위한 런타임 상품 코드. */
  opening_set_code?: string;
}

export interface LuckValueRef {
  box_median_krw: number;
  pack_median_krw: number;
  box_quantiles_krw: number[];
  pack_quantiles_krw: number[];
  quantile_points: number[];
  _iterations?: {
    box: number;
    pack: number;
  };
  _built_at?: string;
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

export interface BundleComponentMeta {
  set_code: string;
  pack_count: number;
}

export interface ResolvedBundleComponent {
  set: SetMeta;
  pack_count: number;
}

export interface SetMeta {
  code: string;
  name_ko: string;
  aliases?: string[];
  series?: string;
  type: string;
  box_size: number;
  pack_size: number;
  box_price_krw: number;
  pack_price_krw: number;
  cards: Card[];
  luck_value_ref?: LuckValueRef | null;
  /** type === 'starter' (스타트 덱 100) 전용 메타. 덱 뽑기 시뮬에서만 사용. */
  start_deck?: StartDeckMeta;
  /** type === 'bundle' 혼합 상품의 원본 팩 구성. */
  bundle_components?: BundleComponentMeta[];
  /** 정적 구성 코드를 실제 세트 메타로 연결한 런타임 전용 값. */
  resolved_bundle_components?: ResolvedBundleComponent[];
}

export interface PackResult {
  cards: Card[];
  source_set_code?: string;
  source_set_name_ko?: string;
}

export interface BoxResult {
  packs: PackResult[];
  summary: Record<string, number>;
  seed: string;
}
