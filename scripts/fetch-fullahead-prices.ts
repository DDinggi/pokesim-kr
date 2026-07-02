#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { parse } from "node-html-parser";

type PriceConfidence = "source" | "manual";

interface CardEntry {
  card_num?: string;
  number?: number;
  rarity?: string | null;
  subtype?: string | null;
  image_url?: string | null;
  price_ref_krw?: number | null;
  price_ref_jpy?: number | null;
  price_ref_usd?: number | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  price_confidence?: PriceConfidence | "proxy" | null;
}

interface SetJson {
  code: string;
  cards: CardEntry[];
}

interface SetsIndex {
  active_sets?: string[];
  planned_sets?: string[];
}

interface PriceCardMatch {
  fullahead_number?: number;
}

interface PriceConfig {
  exchange_rates?: {
    jpy_krw?: number;
  };
  settings?: {
    min_price_ref_krw?: number;
    jp_to_kr_estimate_factor?: number;
    rarity_floor_krw?: Record<string, number>;
  };
  cards?: Record<string, PriceCardMatch>;
}

interface FullaheadItem {
  code: string;
  number: number;
  title: string;
  rarity: string | null;
  priceJpy: number;
  url: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(REPO_ROOT, "data", "sets");
const PUBLIC_SETS_DIR = join(REPO_ROOT, "frontend", "public", "sets");
const SETS_INDEX_PATH = join(REPO_ROOT, "data", "sets-index.json");
const PRICE_CONFIG_PATH = join(REPO_ROOT, "data", "prices", "price-matches.json");
const FULLAHEAD_BASE_URL = "https://pokemon-card-fullahead.com";
const LOW_VALUE_RARITIES = new Set(["C", "U", "R", "RR", "RRR"]);

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const targetSet = readArg("--set");
const all = argv.includes("--all");
const includeLow = argv.includes("--include-low");
const force = argv.includes("--force");
const today = new Date().toISOString().slice(0, 10);

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const priceConfig = readJson<PriceConfig>(PRICE_CONFIG_PATH);
  const jpyKrw = Number(process.env.PRICE_JPY_KRW) || priceConfig.exchange_rates?.jpy_krw || 9.5;
  const jpToKrFactor = normalizeFactor(process.env.PRICE_JP_TO_KR_FACTOR, priceConfig.settings?.jp_to_kr_estimate_factor ?? 0.65);
  const minPriceRefKrw = includeLow ? 0 : priceConfig.settings?.min_price_ref_krw ?? 1000;
  const rarityFloorKrw = {
    AR: 1000,
    TR: 1000,
    SR: 2000,
    SAR: 5000,
    ...(priceConfig.settings?.rarity_floor_krw ?? {}),
  };

  const setCodes = getTargetSetCodes();
  let totalUpdated = 0;
  let totalMatched = 0;
  let totalSkippedLow = 0;
  let totalUnmatchedHigh = 0;
  let setsWithUpdates = 0;

  for (const setCode of setCodes) {
    const dataPath = join(DATA_SETS_DIR, `${setCode}.json`);
    if (!existsSync(dataPath)) {
      console.warn(`[missing-set-file] ${setCode}`);
      continue;
    }

    const set = readJson<SetJson>(dataPath);
    const shopCode = getShopCodeForSet(set);
    if (!shopCode) {
      console.warn(`[missing-shop-code] ${set.code}`);
      continue;
    }

    const shopItems = await fetchFullaheadSetItems(shopCode);
    const byNumber = new Map<number, FullaheadItem>();
    for (const item of shopItems) {
      const previous = byNumber.get(item.number);
      if (!previous || item.priceJpy > previous.priceJpy) {
        byNumber.set(item.number, item);
      }
    }

    let updated = 0;
    let matched = 0;
    let skippedLow = 0;
    let unmatchedHigh = 0;

    for (const card of set.cards) {
      if (!shouldPriceCard(set.code, card)) continue;

      const priceMatch = card.card_num ? priceConfig.cards?.[card.card_num] : undefined;
      const fullaheadNumber = priceMatch?.fullahead_number ?? card.number;
      const item = fullaheadNumber ? byNumber.get(fullaheadNumber) : undefined;
      if (!item || !isCompatibleRarity(card.rarity, item.rarity)) {
        unmatchedHigh++;
        continue;
      }

      matched++;
      const rawKrw = roundKrw(item.priceJpy * jpyKrw * jpToKrFactor);
      const floorKrw = rarityFloorKrw[card.rarity ?? ""] ?? 0;
      const priceKrw = Math.max(rawKrw, floorKrw);
      if (priceKrw < minPriceRefKrw) {
        skippedLow++;
        continue;
      }

      const source = [
        `fullahead:sale:${item.url}`,
        `jp_to_kr_factor=${jpToKrFactor}`,
        priceMatch?.fullahead_number ? `mapped_from_number=${card.number}; fullahead_number=${fullaheadNumber}` : null,
        floorKrw > rawKrw ? `floor_${card.rarity}_krw=${floorKrw}` : null,
      ].filter(Boolean).join("; ");

      if (applyPrice(card, {
        price_ref_krw: priceKrw,
        price_ref_jpy: item.priceJpy,
        price_ref_usd: null,
        price_source: source,
        price_updated_at: today,
        price_confidence: "source",
      })) {
        updated++;
      }
    }

    totalUpdated += updated;
    totalMatched += matched;
    totalSkippedLow += skippedLow;
    totalUnmatchedHigh += unmatchedHigh;

    if (updated > 0) {
      setsWithUpdates++;
      if (!dryRun) {
        const content = `${JSON.stringify(set, null, 2)}\n`;
        writeFileSync(dataPath, content, "utf8");
        writeFileSync(join(PUBLIC_SETS_DIR, `${setCode}.json`), content, "utf8");
      }
    }

    console.log(
      `${set.code}: shop=${shopCode}, shop_items=${shopItems.length}, matched=${matched}, `
      + `updated=${updated}${dryRun ? " (dry)" : ""}, skipped_low=${skippedLow}, unmatched_high=${unmatchedHigh}`,
    );
  }

  console.log(
    `\nDone: updated=${totalUpdated}, sets_with_updates=${setsWithUpdates}, matched=${totalMatched}, `
    + `skipped_low=${totalSkippedLow}, unmatched_high=${totalUnmatchedHigh}`,
  );
}

async function fetchFullaheadSetItems(shopCode: string): Promise<FullaheadItem[]> {
  const { categoryCode, firstHtml } = await fetchFirstCategoryPage(shopCode);
  const items = new Map<string, FullaheadItem>();

  const firstItems = parseFullaheadItems(firstHtml, shopCode);
  for (const item of firstItems) {
    items.set(`${item.code}-${item.number}-${item.priceJpy}`, item);
  }

  const pageNumbers = getPageNumbers(firstHtml, categoryCode).filter((value) => value > 1);
  const maxLinkedPage = Math.max(1, ...pageNumbers);
  const maxSequentialPage = Math.max(maxLinkedPage, 30);

  for (let page = 2; page <= maxSequentialPage; page++) {
    let html: string;
    try {
      html = await fetchEucJp(`${FULLAHEAD_BASE_URL}/shopbrand/${categoryCode}/page${page}/recommend/`);
    } catch {
      break;
    }

    const pageItems = parseFullaheadItems(html, shopCode);
    if (pageItems.length === 0) break;

    for (const item of pageItems) {
      items.set(`${item.code}-${item.number}-${item.priceJpy}`, item);
    }
  }

  return Array.from(items.values());
}

async function fetchFirstCategoryPage(shopCode: string): Promise<{ categoryCode: string; firstHtml: string }> {
  const candidates = getCategoryCandidates(shopCode);
  let lastError: unknown = null;

  for (const categoryCode of candidates) {
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

function getCategoryCandidates(shopCode: string): string[] {
  const lower = shopCode.toLowerCase();
  const padded = lower.replace(/^([a-z]+)(\d)([a-z]*)$/, "$10$2$3");
  const noLeadingZero = lower.replace(/^([a-z]+)0+(\d)/, "$1$2");
  return Array.from(new Set([lower, padded, noLeadingZero]));
}

async function fetchEucJp(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PokeSimKR/1.0; +https://pokesim.kr)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
    },
  });
  if (!response.ok) {
    throw new Error(`FullAhead ${url} returned ${response.status}`);
  }

  return new TextDecoder("euc-jp").decode(await response.arrayBuffer());
}

function parseFullaheadItems(html: string, shopCode: string): FullaheadItem[] {
  const items: FullaheadItem[] = [];
  const codeRegex = new RegExp(`PK-${escapeRegExp(shopCode.toUpperCase())}-([0-9]{1,3})`, "i");
  const root = parse(html);

  for (const nameNode of root.querySelectorAll("span.itemName")) {
    const title = decodeHtml(nameNode.text.trim());
    const codeMatch = title.match(codeRegex);
    if (!codeMatch) continue;

    const anchor = nameNode.parentNode;
    const itemBlock = anchor?.parentNode;
    const priceText = itemBlock?.querySelector("span.itemPrice strong")?.text ?? "";
    const href = anchor?.getAttribute("href") ?? "";
    const number = Number(codeMatch[1]);
    const priceJpy = Number(priceText.replace(/[^\d]/g, ""));
    if (!Number.isFinite(number) || !Number.isFinite(priceJpy) || priceJpy <= 0) continue;

    items.push({
      code: shopCode.toUpperCase(),
      number,
      title,
      rarity: extractRarity(title),
      priceJpy,
      url: normalizeFullaheadUrl(href),
    });
  }

  return items;
}

function normalizeFullaheadUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${FULLAHEAD_BASE_URL}${href}`;
  return `${FULLAHEAD_BASE_URL}/${href}`;
}

function getPageNumbers(html: string, categoryCode: string): number[] {
  const pages = new Set<number>([1]);
  const regex = new RegExp(`/shopbrand/${escapeRegExp(categoryCode.toLowerCase())}/page([0-9]+)`, "gi");
  for (const match of html.matchAll(regex)) {
    pages.add(Number(match[1]));
  }
  return Array.from(pages).filter((page) => Number.isFinite(page) && page > 0);
}

function getShopCodeForSet(set: SetJson): string | null {
  for (const card of set.cards) {
    const code = extractSetCodeFromImage(card.image_url);
    if (code) return code.toLowerCase();
  }
  return null;
}

function extractSetCodeFromImage(imageUrl: string | null | undefined): string | null {
  const match = imageUrl?.match(/\/([A-Za-z0-9]+)_\d+\.(?:png|jpg|jpeg|webp)$/i);
  return match?.[1] ?? null;
}

function isCompatibleRarity(cardRarity: string | null | undefined, itemRarity: string | null): boolean {
  if (!cardRarity || !itemRarity) return true;
  if (cardRarity === itemRarity) return true;
  return cardRarity === "UR" && itemRarity === "MUR";
}

function shouldPriceCard(setCode: string, card: CardEntry): boolean {
  if (!card.rarity) return false;
  // Japanese SMP2 only has holo cards. Korean regular C/U cards have no
  // equivalent FullAhead listing, so sharing the mirror price double-counts them.
  if (
    setCode === "smp2-detective-pikachu"
    && card.subtype !== "미러"
    && (card.rarity === "C" || card.rarity === "U")
  ) return false;
  // Korean SM9a mirror cards have no like-for-like Japanese listing.
  if (setCode === "sm9a-night-unison" && card.subtype === "미러") return false;
  if (includeLow) return true;
  if (LOW_VALUE_RARITIES.has(card.rarity)) return false;
  return true;
}

function applyPrice(
  card: CardEntry,
  price: Required<Pick<CardEntry, "price_ref_krw" | "price_ref_jpy" | "price_ref_usd" | "price_source" | "price_updated_at">>
    & { price_confidence: PriceConfidence },
): boolean {
  if (!force && card.price_confidence && card.price_confidence !== "proxy") return false;

  const changed = (
    card.price_ref_krw !== price.price_ref_krw
    || card.price_ref_jpy !== price.price_ref_jpy
    || card.price_ref_usd !== price.price_ref_usd
    || card.price_source !== price.price_source
    || card.price_updated_at !== price.price_updated_at
    || card.price_confidence !== price.price_confidence
  );

  Object.assign(card, price);
  return changed;
}

function getTargetSetCodes(): string[] {
  if (targetSet) return [targetSet];
  const index = readJson<SetsIndex>(SETS_INDEX_PATH);
  const active = index.active_sets ?? [];
  const planned = all ? index.planned_sets ?? [] : [];
  return [...active, ...planned];
}

function extractRarity(title: string): string | null {
  const normalized = title.toUpperCase();
  const match = normalized.match(/\b(BWR|MUR|GRA|SAR|CSR|CHR|SSR|AR|SR|HR|UR|ACE|TR|PR|K)\b/);
  return match?.[1] ?? null;
}

function roundKrw(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

function normalizeFactor(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(0.1, Math.min(1, value));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readArg(name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}
