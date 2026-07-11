#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

interface ManifestCard {
  number: number;
  name_ko: string;
  rarity: string;
  card_type: string;
}

interface ManifestSet {
  set_code: string;
  shop_code: string;
  cards: ManifestCard[];
}

interface FullaheadItem {
  number: number;
  rarity: string | null;
  priceJpy: number;
  url: string;
}

interface SetCard {
  card_num: string;
  number: number | null;
  name_ko: string | null;
  rarity: string | null;
  card_type: string | null;
  subtype: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
  _source?: string;
  _image_source_url?: string;
  _fetched_at?: string;
  _manual?: boolean;
  price_ref_krw?: number | null;
  price_ref_jpy?: number | null;
  price_ref_usd?: number | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  price_confidence?: string | null;
}

interface SetJson {
  cards: SetCard[];
}

interface PriceConfig {
  exchange_rates?: { jpy_krw?: number };
  settings?: {
    jp_to_kr_estimate_factor?: number;
    rarity_floor_krw?: Record<string, number>;
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const FULLAHEAD_BASE_URL = 'https://pokemon-card-fullahead.com';
const UA = 'Mozilla/5.0 (compatible; PokeSimKR/1.0; +https://pokesim.kr)';
const argv = process.argv.slice(2);
const manifestArg = readArg('--manifest');
const targetSet = readArg('--set');

if (!manifestArg) {
  console.error('Usage: pnpm import:fullahead-secrets -- --manifest <path> [--set <code>]');
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

async function main(): Promise<void> {
  const manifestPath = resolve(process.cwd(), manifestArg);
  const manifest = readJson<{ sets: ManifestSet[] }>(manifestPath);
  const priceConfig = readJson<PriceConfig>(join(REPO_ROOT, 'data', 'prices', 'price-matches.json'));
  const jpyKrw = priceConfig.exchange_rates?.jpy_krw ?? 9.5;
  const jpToKrFactor = priceConfig.settings?.jp_to_kr_estimate_factor ?? 0.65;
  const rarityFloorKrw = priceConfig.settings?.rarity_floor_krw ?? {};
  const sets = targetSet
    ? manifest.sets.filter((set) => set.set_code === targetSet)
    : manifest.sets;

  if (sets.length === 0) throw new Error(`No manifest set matched ${targetSet}`);
  for (const manifestSet of sets) {
    await importSet(manifestSet, jpyKrw, jpToKrFactor, rarityFloorKrw);
  }
}

async function importSet(
  manifestSet: ManifestSet,
  jpyKrw: number,
  jpToKrFactor: number,
  rarityFloorKrw: Record<string, number>,
): Promise<void> {
  const setPath = join(REPO_ROOT, 'data', 'sets', `${manifestSet.set_code}.json`);
  const set = readJson<SetJson>(setPath);
  const prefix = set.cards.find((card) => card.card_num)?.card_num.slice(0, -3);
  if (!prefix) throw new Error(`${manifestSet.set_code}: cannot infer card_num prefix`);

  const items = await fetchFullaheadSetItems(manifestSet.shop_code);
  const byNumber = new Map<number, FullaheadItem>();
  for (const item of items) {
    const previous = byNumber.get(item.number);
    if (!previous || item.priceJpy > previous.priceJpy) byNumber.set(item.number, item);
  }

  const imported = await mapLimit(manifestSet.cards, 6, async (manifestCard) => {
    const item = byNumber.get(manifestCard.number);
    if (!item) throw new Error(`${manifestSet.set_code} #${manifestCard.number}: FullAhead item missing`);
    if (item.rarity !== manifestCard.rarity) {
      throw new Error(`${manifestSet.set_code} #${manifestCard.number}: rarity ${item.rarity} != ${manifestCard.rarity}`);
    }

    const imageSourceUrl = await fetchItemImage(item.url);
    const baseCardNum = `${prefix}${String(manifestCard.number).padStart(3, '0')}`;
    const hasCardNumCollision = set.cards.some(
      (card) => card.card_num === baseCardNum && card.number !== manifestCard.number,
    );
    const cardNum = hasCardNumCollision
      ? `${prefix}J${String(manifestCard.number).padStart(3, '0')}`
      : baseCardNum;
    const rawKrw = roundKrw(item.priceJpy * jpyKrw * jpToKrFactor);
    const priceKrw = Math.max(rawKrw, rarityFloorKrw[manifestCard.rarity] ?? 0);

    return {
      card_num: cardNum,
      number: manifestCard.number,
      name_ko: manifestCard.name_ko,
      rarity: manifestCard.rarity,
      card_type: manifestCard.card_type,
      subtype: null,
      hp: null,
      type: null,
      image_url: `external/${manifestSet.set_code}/${cardNum}.${extensionFromUrl(imageSourceUrl)}`,
      _source: item.url,
      _image_source_url: imageSourceUrl,
      _fetched_at: today(),
      _manual: true,
      price_ref_krw: priceKrw,
      price_ref_jpy: item.priceJpy,
      price_ref_usd: null,
      price_source: `fullahead:sale:${item.url}; jp_to_kr_factor=${jpToKrFactor}`,
      price_updated_at: today(),
      price_confidence: 'source',
    } satisfies SetCard;
  });

  const importedNumbers = new Set(imported.map((card) => card.number));
  set.cards = set.cards.filter((card) => card.number === null || !importedNumbers.has(card.number));
  set.cards.push(...imported);
  set.cards.sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER));
  writeFileSync(setPath, `${JSON.stringify(set, null, 2)}\n`, 'utf8');
  console.log(`${manifestSet.set_code}: imported ${imported.length} FullAhead secret card(s)`);
}

async function fetchFullaheadSetItems(shopCode: string): Promise<FullaheadItem[]> {
  const { categoryCode, firstHtml } = await fetchFirstCategoryPage(shopCode);
  const items = new Map<string, FullaheadItem>();
  addItems(items, parseFullaheadItems(firstHtml, shopCode));

  for (let page = 2; page <= 30; page++) {
    let html: string;
    try {
      html = await fetchEucJp(`${FULLAHEAD_BASE_URL}/shopbrand/${categoryCode}/page${page}/recommend/`);
    } catch {
      break;
    }
    const pageItems = parseFullaheadItems(html, shopCode);
    if (pageItems.length === 0) break;
    addItems(items, pageItems);
  }

  return [...items.values()];
}

async function fetchFirstCategoryPage(shopCode: string): Promise<{ categoryCode: string; firstHtml: string }> {
  let lastError: unknown;
  for (const categoryCode of categoryCandidates(shopCode)) {
    try {
      return {
        categoryCode,
        firstHtml: await fetchEucJp(`${FULLAHEAD_BASE_URL}/shopbrand/${categoryCode}/`),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`No FullAhead category for ${shopCode}`);
}

function parseFullaheadItems(html: string, shopCode: string): FullaheadItem[] {
  const items: FullaheadItem[] = [];
  const codeRegex = new RegExp(`PK-${fullaheadCodePattern(shopCode)}-([0-9]{1,3})`, 'i');
  const root = parse(html);

  for (const nameNode of root.querySelectorAll('span.itemName')) {
    const title = decodeHtml(nameNode.text.trim());
    const codeMatch = title.match(codeRegex);
    if (!codeMatch) continue;
    const anchor = nameNode.parentNode;
    const priceText = anchor?.parentNode?.querySelector('span.itemPrice strong')?.text ?? '';
    const href = anchor?.getAttribute('href') ?? '';
    const number = Number(codeMatch[1]);
    const priceJpy = Number(priceText.replace(/[^\d]/g, ''));
    if (!Number.isFinite(number) || !Number.isFinite(priceJpy) || priceJpy <= 0) continue;
    items.push({ number, rarity: extractRarity(title), priceJpy, url: normalizeFullaheadUrl(href) });
  }

  return items;
}

async function fetchItemImage(url: string): Promise<string> {
  const root = parse(await fetchEucJp(url));
  const image = root.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (!image?.startsWith('http')) throw new Error(`${url}: og:image missing`);
  return image;
}

async function fetchEucJp(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8' } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return new TextDecoder('euc-jp').decode(await response.arrayBuffer());
}

function addItems(target: Map<string, FullaheadItem>, items: FullaheadItem[]): void {
  for (const item of items) target.set(`${item.number}-${item.priceJpy}`, item);
}

function categoryCandidates(shopCode: string): string[] {
  const lower = shopCode.toLowerCase();
  const padded = lower.replace(/^([a-z]+)(\d)([a-z]*)$/, '$10$2$3');
  const noLeadingZero = lower.replace(/^([a-z]+)0+(\d)/, '$1$2');
  return [...new Set([lower, padded, noLeadingZero])];
}

function fullaheadCodePattern(shopCode: string): string {
  const escaped = escapeRegExp(shopCode.toUpperCase());
  return escaped.endsWith('PLUS') ? `${escaped.slice(0, -4)}(?:PLUS|\\+)` : escaped;
}

function normalizeFullaheadUrl(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  return `${FULLAHEAD_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

function extractRarity(title: string): string | null {
  return title.toUpperCase().match(/\b(BWR|MUR|GRA|SAR|CSR|CHR|SSR|AR|SR|HR|UR|ACE|TR|PR|K)\b/)?.[1] ?? null;
}

function extensionFromUrl(url: string): string {
  return url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'jpg';
}

function roundKrw(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function decodeHtml(value: string): string {
  return value.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readArg(name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < values.length) {
      const current = index++;
      results[current] = await mapper(values[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}
