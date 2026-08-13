import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import dailyLuckModule from '../frontend/lib/dailyLuck.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

// The frontend package is CommonJS from this ESM scripts package's perspective.
const {
  DAILY_LUCK_SET_CODES,
  DAILY_LUCK_SET_SOURCE_SLUGS,
  isDailyLuckResultCard,
} = dailyLuckModule as unknown as typeof import('../frontend/lib/dailyLuck.ts');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = resolve(ROOT, 'frontend/lib/dailyLuckPrices.generated.json');
const SOURCE_BASE_URL = 'https://ggvalue.com';
const SYNC_DELAY_MS = 450;

interface GgValueCard {
  cardNumber: number;
  estimatedPrice: number;
  name: string;
  rarity: string;
  recentSamples: number;
  samples: number;
  state: string;
}

interface GgValueMarket {
  cards: GgValueCard[];
  expectedCardValue: number;
}

interface GgValueSet {
  boxPrice: number;
  code: string;
  name: string;
  slug: string;
}

interface GeneratedSetPrices {
  slug: string;
  sourceUrl: string;
  expectedCardValueKrw: number;
  boxPriceKrw: number;
  pricedCards: number;
  fallbackCards: number;
  pricesByNumber: Record<string, number>;
}

function normalizeCardName(value: string | null): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeSourceRarity(setCode: string, rarity: string): string {
  return setCode.startsWith('m') && rarity === 'MUR' ? 'UR' : rarity;
}

function cardIdentity(name: string | null, rarity: string | null): string {
  return `${normalizeCardName(name)}:${rarity ?? ''}`;
}

function extractBalancedObject(source: string, marker: string): unknown {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Embedded ${marker} payload not found`);

  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) throw new Error(`Embedded ${marker} object start not found`);

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(start, index + 1));
    }
  }

  throw new Error(`Embedded ${marker} object was not balanced`);
}

function decodeRscPayloads(html: string): string {
  const marker = 'self.__VINEXT_RSC_CHUNKS__.push(';
  return parse(html)
    .querySelectorAll('script')
    .flatMap((script) => {
      const text = script.rawText.trim();
      const start = text.indexOf(marker);
      if (start < 0 || !text.endsWith(')')) return [];
      const argument = text.slice(start + marker.length, -1);
      try {
        const decoded = JSON.parse(argument);
        return typeof decoded === 'string' ? [decoded] : [];
      } catch {
        return [];
      }
    })
    .join('\n');
}

async function fetchSetPage(slug: string): Promise<{ market: GgValueMarket; set: GgValueSet }> {
  const sourceUrl = `${SOURCE_BASE_URL}/sets/${slug}`;
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'PokeSimKR reference-price sync (+https://pokesim.kr)',
    },
  });
  if (!response.ok) throw new Error(`${sourceUrl}: HTTP ${response.status}`);

  const payload = decodeRscPayloads(await response.text());
  return {
    market: extractBalancedObject(payload, '"market":') as GgValueMarket,
    set: extractBalancedObject(payload, '"set":') as GgValueSet,
  };
}

function readLocalSet(setCode: string): SetMeta {
  const setPath = resolve(ROOT, `data/sets/${setCode}.json`);
  return JSON.parse(readFileSync(setPath, 'utf8')) as SetMeta;
}

function validateAndMapPrices(
  setCode: string,
  localSet: SetMeta,
  sourceSet: GgValueSet,
  market: GgValueMarket,
): GeneratedSetPrices {
  if (!Array.isArray(market.cards) || market.cards.length === 0) {
    throw new Error(`${setCode}: GGValue price cards are empty`);
  }

  const localCardsByIdentity = new Map<string, SetMeta['cards']>();
  for (const card of localSet.cards) {
    const identity = cardIdentity(card.name_ko, card.rarity);
    const candidates = localCardsByIdentity.get(identity) ?? [];
    candidates.push(card);
    localCardsByIdentity.set(identity, candidates);
  }

  const pricesByNumber: Record<string, number> = {};
  for (const card of market.cards) {
    if (card.state !== 'priced' || !Number.isFinite(card.estimatedPrice) || card.estimatedPrice <= 0) {
      continue;
    }

    const localRarity = normalizeSourceRarity(setCode, card.rarity);
    const candidates = localCardsByIdentity.get(cardIdentity(card.name, localRarity)) ?? [];
    const localCard = candidates.length === 1
      ? candidates[0]
      : candidates.find((candidate) => candidate.number === card.cardNumber);
    if (!localCard) {
      continue;
    }
    if (pricesByNumber[String(localCard.number)] !== undefined) {
      throw new Error(`${setCode}: duplicate price match for ${localCard.card_num}`);
    }
    pricesByNumber[String(localCard.number)] = Math.round(card.estimatedPrice);
  }

  const fallbackCards = localSet.cards.filter(
    (card) => isDailyLuckResultCard(card)
      && pricesByNumber[String(card.number)] === undefined,
  ).length;

  const sourceUrl = `${SOURCE_BASE_URL}/sets/${sourceSet.slug}`;
  return {
    slug: sourceSet.slug,
    sourceUrl,
    expectedCardValueKrw: Math.round(market.expectedCardValue),
    boxPriceKrw: Math.round(sourceSet.boxPrice),
    pricedCards: Object.keys(pricesByNumber).length,
    fallbackCards,
    pricesByNumber,
  };
}

async function main() {
  const sets: Record<string, GeneratedSetPrices> = {};
  for (const [index, setCode] of DAILY_LUCK_SET_CODES.entries()) {
    const slug = DAILY_LUCK_SET_SOURCE_SLUGS[setCode];
    const localSet = readLocalSet(setCode);
    const { market, set } = await fetchSetPage(slug);
    if (set.slug !== slug) throw new Error(`${setCode}: expected ${slug}, received ${set.slug}`);

    sets[setCode] = validateAndMapPrices(setCode, localSet, set, market);
    console.log(
      `${setCode}: ${sets[setCode].pricedCards} matched prices, `
      + `${sets[setCode].fallbackCards} capped fallbacks, `
      + `${sets[setCode].expectedCardValueKrw.toLocaleString()} KRW expected value`,
    );
    if (index < DAILY_LUCK_SET_CODES.length - 1) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, SYNC_DELAY_MS));
    }
  }

  const output = {
    source: {
      name: '깡값',
      url: `${SOURCE_BASE_URL}/cards`,
      syncedAt: new Date().toISOString(),
      note: '공개 확장팩 페이지에 표시된 한국판 추정 시세이며 실제 거래가를 보증하지 않습니다.',
    },
    sets,
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

await main();
