#!/usr/bin/env tsx

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(REPO_ROOT, "data", "sets");
const PUBLIC_SETS_DIR = join(REPO_ROOT, "frontend", "public", "sets");
const MATCHES_FILE = join(REPO_ROOT, "data", "prices", "price-matches.json");

type PriceConfidence = "source" | "manual";

interface ExchangeRates {
  jpy_krw?: number;
  usd_krw?: number;
  eur_krw?: number;
  updated_at?: string;
  source?: string;
}

interface PokemonTcgIoMatch {
  provider: "pokemontcgio";
  id: string;
  price_variant?: string;
  price_field?: string;
  note?: string;
}

interface ManualMatch {
  provider: "manual";
  price_ref_krw: number;
  price_ref_usd?: number | null;
  price_source: string;
  price_updated_at?: string | null;
  note?: string;
}

interface ManualJpyMatch {
  provider: "manual_jpy";
  price_ref_jpy: number;
  price_source: string;
  price_updated_at?: string | null;
  note?: string;
}

interface DorasutaMatch {
  provider: "dorasuta";
  url: string;
  note?: string;
}

type CardMatch = PokemonTcgIoMatch | ManualMatch | ManualJpyMatch | DorasutaMatch;

interface PriceMatches {
  exchange_rates?: ExchangeRates;
  settings?: {
    min_price_ref_krw?: number;
    jp_to_kr_estimate_factor?: number;
    rarity_floor_krw?: Record<string, number>;
  };
  cards?: Record<string, CardMatch>;
}

interface CardEntry {
  card_num?: string;
  number?: number;
  name_ko?: string | null;
  rarity?: string | null;
  price_ref_krw?: number | null;
  price_ref_jpy?: number | null;
  price_ref_usd?: number | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  price_confidence?: PriceConfidence | null;
}

interface SetJson {
  code?: string;
  cards?: CardEntry[];
}

interface PriceResult {
  price_ref_krw: number;
  price_ref_jpy: number | null;
  price_ref_usd: number | null;
  price_source: string;
  price_updated_at: string;
  price_confidence: PriceConfidence;
}

interface LoadedSet {
  file: string;
  dataPath: string;
  publicPath: string;
  setCode: string;
  json: SetJson;
  changed: boolean;
}

interface PokemonTcgIoCard {
  id?: string;
  name?: string;
  tcgplayer?: {
    updatedAt?: string;
    prices?: Record<string, Record<string, number | undefined> | undefined>;
  };
  cardmarket?: {
    updatedAt?: string;
    prices?: Record<string, number | undefined>;
  };
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const syncPublic = !argv.includes("--no-sync-public");
const targetSet = readArg("--set");
const targetCard = readArg("--card");
const limit = Number(readArg("--limit") ?? 0);
const includeLow = argv.includes("--include-low");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(MATCHES_FILE)) {
    throw new Error(`Missing price mapping file: ${MATCHES_FILE}`);
  }

  const matches = readJson<PriceMatches>(MATCHES_FILE);
  const rates = normalizeRates(matches.exchange_rates);
  const jpToKrEstimateFactor = normalizeJpToKrEstimateFactor(matches.settings?.jp_to_kr_estimate_factor);
  const minPriceRefKrw = includeLow ? 0 : matches.settings?.min_price_ref_krw ?? 1000;
  const rarityFloorKrw = normalizeRarityFloorKrw(matches.settings?.rarity_floor_krw);
  const loadedSets = loadSets();
  const byCardNum = indexCards(loadedSets);
  const entries = Object.entries(matches.cards ?? {})
    .filter(([cardNum]) => !targetCard || cardNum === targetCard)
    .slice(0, limit > 0 ? limit : undefined);

  if (entries.length === 0) {
    console.log("No price mappings to apply.");
    return;
  }

  let updatedCards = 0;
  let missingCards = 0;

  for (const [cardNum, match] of entries) {
    const targets = byCardNum.get(cardNum) ?? [];
    if (targets.length === 0) {
      console.warn(`[missing] ${cardNum}: card_num not found in selected sets.`);
      missingCards++;
      continue;
    }

    const rawPrice = await resolvePrice(match, rates, jpToKrEstimateFactor);
    for (const target of targets) {
      const price = applyRarityFloor(
        rawPrice,
        target.card,
        rarityFloorKrw,
      );
      if (price.price_ref_krw < minPriceRefKrw) {
        console.log(
          `[skip-low] ${cardNum}: ${price.price_ref_krw.toLocaleString()} KRW `
          + `< ${minPriceRefKrw.toLocaleString()} KRW (${price.price_source})`,
        );
        continue;
      }

      if (applyPrice(target.card, price)) {
        target.loaded.changed = true;
        updatedCards++;
        console.log(
          `[price] ${target.loaded.setCode} #${target.card.number ?? "?"} ${cardNum}: `
          + `${price.price_ref_krw.toLocaleString()} KRW (${price.price_source})`,
        );
      }
    }
  }

  const changedSets = loadedSets.filter((set) => set.changed);
  for (const loaded of changedSets) {
    if (dryRun) {
      console.log(`[dry] would write ${loaded.file}`);
      continue;
    }

    const content = `${JSON.stringify(loaded.json, null, 2)}\n`;
    writeFileSync(loaded.dataPath, content, "utf8");
    if (syncPublic) {
      writeFileSync(loaded.publicPath, content, "utf8");
    }
  }

  console.log(
    `\nDone: ${updatedCards} card updates, ${changedSets.length} set files`
    + `${dryRun ? " (dry-run)" : ""}, ${missingCards} missing mappings.`,
  );
}

function loadSets(): LoadedSet[] {
  return readdirSync(DATA_SETS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !targetSet || file === `${targetSet}.json`)
    .sort()
    .map((file) => {
      const dataPath = join(DATA_SETS_DIR, file);
      const setCode = file.replace(/\.json$/, "");
      return {
        file,
        dataPath,
        publicPath: join(PUBLIC_SETS_DIR, file),
        setCode,
        json: readJson<SetJson>(dataPath),
        changed: false,
      };
    });
}

function indexCards(sets: LoadedSet[]) {
  const byCardNum = new Map<string, Array<{ loaded: LoadedSet; card: CardEntry }>>();
  for (const loaded of sets) {
    for (const card of loaded.json.cards ?? []) {
      if (!card.card_num) continue;
      const bucket = byCardNum.get(card.card_num) ?? [];
      bucket.push({ loaded, card });
      byCardNum.set(card.card_num, bucket);
    }
  }
  return byCardNum;
}

function normalizeRates(config: ExchangeRates | undefined) {
  const jpyFromEnv = Number(process.env.PRICE_JPY_KRW);
  const usdFromEnv = Number(process.env.PRICE_USD_KRW);
  const eurFromEnv = Number(process.env.PRICE_EUR_KRW);
  return {
    jpy_krw: Number.isFinite(jpyFromEnv) && jpyFromEnv > 0 ? jpyFromEnv : config?.jpy_krw ?? 9.5,
    usd_krw: Number.isFinite(usdFromEnv) && usdFromEnv > 0 ? usdFromEnv : config?.usd_krw ?? 1350,
    eur_krw: Number.isFinite(eurFromEnv) && eurFromEnv > 0 ? eurFromEnv : config?.eur_krw ?? 1450,
  };
}

function normalizeJpToKrEstimateFactor(configValue: number | undefined) {
  const fromEnv = Number(process.env.PRICE_JP_TO_KR_FACTOR);
  const value = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : configValue ?? 0.65;
  return Math.max(0.1, Math.min(1, value));
}

async function resolvePrice(
  match: CardMatch,
  rates: { jpy_krw: number; usd_krw: number; eur_krw: number },
  jpToKrEstimateFactor: number,
): Promise<PriceResult> {
  if (match.provider === "manual") {
    if (!Number.isFinite(match.price_ref_krw) || match.price_ref_krw <= 0) {
      throw new Error(`Invalid manual price_ref_krw: ${match.price_ref_krw}`);
    }

    return {
      price_ref_krw: Math.round(match.price_ref_krw),
      price_ref_jpy: null,
      price_ref_usd: match.price_ref_usd ?? null,
      price_source: match.price_source,
      price_updated_at: match.price_updated_at ?? todayIso(),
      price_confidence: "manual",
    };
  }

  if (match.provider === "manual_jpy") {
    if (!Number.isFinite(match.price_ref_jpy) || match.price_ref_jpy <= 0) {
      throw new Error(`Invalid manual_jpy price_ref_jpy: ${match.price_ref_jpy}`);
    }

    return {
      price_ref_krw: roundKrw(match.price_ref_jpy * rates.jpy_krw * jpToKrEstimateFactor),
      price_ref_jpy: Math.round(match.price_ref_jpy),
      price_ref_usd: null,
      price_source: `${match.price_source}; jp_to_kr_factor=${jpToKrEstimateFactor}`,
      price_updated_at: match.price_updated_at ?? todayIso(),
      price_confidence: "manual",
    };
  }

  if (match.provider === "dorasuta") {
    return fetchDorasutaPrice(match, rates, jpToKrEstimateFactor);
  }

  return fetchPokemonTcgIoPrice(match, rates);
}

async function fetchDorasutaPrice(
  match: DorasutaMatch,
  rates: { jpy_krw: number },
  jpToKrEstimateFactor: number,
): Promise<PriceResult> {
  const response = await fetch(match.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PokeSimKR/1.0; +https://pokesim.kr)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
    },
  });
  if (!response.ok) {
    throw new Error(`DoraStar ${match.url} returned ${response.status}`);
  }

  const html = await response.text();
  const priceJpy = pickDorasutaStateAPrice(html);
  if (!priceJpy) {
    throw new Error(`DoraStar ${match.url} has no usable state A price.`);
  }

  const mode = match.url.includes("buy.dorasuta.jp") ? "buy" : "sale";
  return {
    price_ref_krw: roundKrw(priceJpy * rates.jpy_krw * jpToKrEstimateFactor),
    price_ref_jpy: priceJpy,
    price_ref_usd: null,
    price_source: `dorasuta:${mode}:${match.url}; jp_to_kr_factor=${jpToKrEstimateFactor}`,
    price_updated_at: todayIso(),
    price_confidence: "source",
  };
}

async function fetchPokemonTcgIoPrice(
  match: PokemonTcgIoMatch,
  rates: { usd_krw: number; eur_krw: number },
): Promise<PriceResult> {
  const response = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(match.id)}`, {
    headers: process.env.POKEMONTCG_IO_API_KEY
      ? { "X-Api-Key": process.env.POKEMONTCG_IO_API_KEY }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`PokemonTCG.io ${match.id} returned ${response.status}`);
  }

  const body = await response.json() as { data?: PokemonTcgIoCard };
  const card = body.data;
  if (!card) {
    throw new Error(`PokemonTCG.io ${match.id} returned no card data.`);
  }

  const tcgplayer = pickTcgplayerPrice(card, match);
  if (tcgplayer) {
    return {
      price_ref_krw: roundKrw(tcgplayer.price * rates.usd_krw),
      price_ref_jpy: null,
      price_ref_usd: roundUsd(tcgplayer.price),
      price_source: `pokemontcg.io/tcgplayer:${match.id}:${tcgplayer.variant}.${tcgplayer.field}`,
      price_updated_at: normalizeUpdatedAt(card.tcgplayer?.updatedAt),
      price_confidence: "source",
    };
  }

  const cardmarket = pickCardmarketPrice(card);
  if (cardmarket) {
    return {
      price_ref_krw: roundKrw(cardmarket.price * rates.eur_krw),
      price_ref_jpy: null,
      price_ref_usd: null,
      price_source: `pokemontcg.io/cardmarket:${match.id}:${cardmarket.field}`,
      price_updated_at: normalizeUpdatedAt(card.cardmarket?.updatedAt),
      price_confidence: "source",
    };
  }

  throw new Error(`PokemonTCG.io ${match.id} has no usable TCGplayer/Cardmarket price.`);
}

function pickTcgplayerPrice(card: PokemonTcgIoCard, match: PokemonTcgIoMatch) {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;

  const variants = match.price_variant
    ? [match.price_variant]
    : [
      "holofoil",
      "reverseHolofoil",
      "normal",
      "1stEditionHolofoil",
      "1stEditionNormal",
      "unlimitedHolofoil",
      "unlimitedNormal",
    ];
  const fields = match.price_field ? [match.price_field] : ["market", "mid", "low"];

  for (const variant of variants) {
    const variantPrices = prices[variant];
    if (!variantPrices) continue;
    for (const field of fields) {
      const price = variantPrices[field];
      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        return { variant, field, price };
      }
    }
  }

  return null;
}

function pickCardmarketPrice(card: PokemonTcgIoCard) {
  const prices = card.cardmarket?.prices;
  if (!prices) return null;

  for (const field of ["averageSellPrice", "trendPrice", "avg7", "avg30", "avg1"]) {
    const price = prices[field];
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      return { field, price };
    }
  }

  return null;
}

function pickDorasutaStateAPrice(html: string): number | null {
  const normalized = html
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ");
  const stateAMatch = normalized.match(/状態A\s*([0-9,]+)\s*円/);
  const priceText = stateAMatch?.[1];
  if (!priceText) return null;

  const price = Number(priceText.replace(/,/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeRarityFloorKrw(config: Record<string, number> | undefined): Record<string, number> {
  return {
    AR: 1000,
    SR: 2000,
    SAR: 5000,
    ...(config ?? {}),
  };
}

function applyRarityFloor(
  price: PriceResult,
  card: CardEntry,
  rarityFloorKrw: Record<string, number>,
): PriceResult {
  const rarity = card.rarity ?? "";
  const floor = rarityFloorKrw[rarity] ?? 0;
  if (floor <= 0 || price.price_ref_krw >= floor) return price;

  return {
    ...price,
    price_ref_krw: floor,
    price_source: `${price.price_source}; floor_${rarity}_krw=${floor}`,
  };
}

function applyPrice(card: CardEntry, price: PriceResult): boolean {
  const next = {
    price_ref_krw: price.price_ref_krw,
    price_ref_jpy: price.price_ref_jpy,
    price_ref_usd: price.price_ref_usd,
    price_source: price.price_source,
    price_updated_at: price.price_updated_at,
    price_confidence: price.price_confidence,
  };

  const changed = (
    card.price_ref_krw !== next.price_ref_krw
    || card.price_ref_jpy !== next.price_ref_jpy
    || card.price_ref_usd !== next.price_ref_usd
    || card.price_source !== next.price_source
    || card.price_updated_at !== next.price_updated_at
    || card.price_confidence !== next.price_confidence
  );

  Object.assign(card, next);
  return changed;
}

function roundKrw(value: number) {
  return Math.max(0, Math.round(value / 100) * 100);
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeUpdatedAt(value: string | undefined) {
  if (!value) return todayIso();
  return value.replace(/\//g, "-");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readArg(name: string) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}
