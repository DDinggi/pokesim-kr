import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const setPath = join(ROOT, 'data', 'sets', 'm6-storm-emerald.json');
const KOREAN_IMAGE_BASE = 'https://cards.image.pokemonkorea.co.kr/data/wmimages/MEGA/M6';
const FETCHED_AT = '2026-08-21';

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Card {
  card_num: string;
  number: number;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
  subtype: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
  _source: string;
  _fetched_at: string;
  _manual?: boolean;
  _image_source_url?: string;
  _image_composite_source?: string;
  _image_crop?: CropBox;
  [key: string]: unknown;
}

interface SetData {
  name_ko: string;
  fullahead_shop_code?: string;
  cards: Card[];
  _notes?: string;
}

const japaneseFallbacks = new Map<number, { key: string; source: string }>([
  [
    9,
    {
      key: 'external/m6-storm-emerald/JP2026M6009.jpg',
      source: 'https://www.pokemon-card.com/ex/m6/assets/images/card/m6-009-sxbub.png',
    },
  ],
  [
    33,
    {
      key: 'external/m6-storm-emerald/JP2026M6033.jpg',
      source: 'https://www.pokemon-card.com/ex/m6/assets/images/card/m6-033-g8hda.png',
    },
  ],
  [
    48,
    {
      key: 'external/m6-storm-emerald/JP2026M6048.jpg',
      source: 'https://www.pokemon-card.com/ex/m6/assets/images/card/m6-048-u5t2n.png',
    },
  ],
]);

const pairSpecs = [
  { left: 71, right: 72, name: '전설의 산정' },
  { left: 73, right: 74, name: '전설의 용암동굴' },
  { left: 75, right: 76, name: '전설의 해구' },
] as const;

const leftCrop: CropBox = { left: 1, top: 0, width: 868, height: 1212 };
const rightCrop: CropBox = { left: 871, top: 0, width: 868, height: 1212 };

function cardByNumber(set: SetData, number: number): Card {
  const card = set.cards.find((candidate) => candidate.number === number);
  if (!card) throw new Error(`M6 card #${number} is missing.`);
  return card;
}

function applyPairCard(
  card: Card,
  number: number,
  name: string,
  sourceNumber: number,
  crop: CropBox,
) {
  const padded = String(number).padStart(3, '0');
  const sourcePadded = String(sourceNumber).padStart(3, '0');
  card.card_num = `BS2026005${padded}`;
  card.name_ko = name;
  card.rarity = 'U';
  card.card_type = '트레이너';
  card.subtype = null;
  card.hp = null;
  card.type = null;
  card.image_url = `wmimages/MEGA/M6/M6_${padded}.png`;
  card._source = `https://pokemoncard.co.kr/cards/detail/BS2026005${sourcePadded}`;
  card._fetched_at = FETCHED_AT;
  card._image_composite_source = `${KOREAN_IMAGE_BASE}/M6_${sourcePadded}.png`;
  card._image_crop = crop;
  delete card._manual;
  delete card._image_source_url;
}

function main() {
  const set = JSON.parse(readFileSync(setPath, 'utf8')) as SetData;
  set.name_ko = 'MEGA 확장팩 「스톰에메랄다」';
  set.fullahead_shop_code = 'm6';

  for (const [number, fallback] of japaneseFallbacks) {
    const card = cardByNumber(set, number);
    card.image_url = fallback.key;
    card._image_source_url = fallback.source;
    delete card._image_composite_source;
    delete card._image_crop;
  }

  for (const pair of pairSpecs) {
    applyPairCard(cardByNumber(set, pair.left), pair.left, pair.name, pair.left, leftCrop);
    applyPairCard(cardByNumber(set, pair.right), pair.right, pair.name, pair.left, rightCrop);
  }

  set._notes =
    '2026-08-21 pokemoncard.co.kr 공식 M6 73개 레코드를 번호 기준으로 병합했다. ' +
    '71/73/75번의 한국 공식 좌우 합본 이미지는 71~76번 실물 카드 6장으로 분할한다. ' +
    '공식 CDN이 HTTP 415를 반환하는 9/33/48번과 아직 한국 DB에 없는 77~113번만 일본 고화질 이미지를 폴백으로 유지한다.';

  writeFileSync(setPath, `${JSON.stringify(set, null, 2)}\n`, 'utf8');
  console.log('Finalized Korean M6 metadata, image fallbacks, and three two-card composites.');
}

main();
