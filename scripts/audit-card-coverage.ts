import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

interface CardEntry {
  card_num?: string | null;
  number?: number | null;
  name_ko?: string | null;
  rarity?: string | null;
  image_url?: string | null;
  price_ref_krw?: number | null;
}

interface SetJson {
  code: string;
  name_ko?: string;
  type?: string;
  cards: CardEntry[];
}

interface SetsIndex {
  active_sets?: string[];
  planned_sets?: string[];
}

interface FullaheadItem {
  number: number;
  title: string;
  rarity: string | null;
  priceJpy: number;
  url: string;
}

interface AuditResult {
  setCode: string;
  shopCode: string | null;
  status: "ok" | "warn" | "skip" | "error";
  localCards: number;
  localMax: number;
  localNumberGaps: number[];
  fullaheadCards: number;
  fullaheadMax: number;
  missingNumbers: FullaheadItem[];
  missingHighNumbers: FullaheadItem[];
  unpricedHighCards: CardEntry[];
  error?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(ROOT, "data", "sets");
const SETS_INDEX_PATH = join(ROOT, "data", "sets-index.json");
const FULLAHEAD_BASE_URL = "https://pokemon-card-fullahead.com";
const LOW_RARITIES = new Set(["C", "U", "R", "RR", "RRR"]);
const HIGH_RARITIES = new Set([
  "S",
  "A",
  "25TH",
  "S8AP",
  "K",
  "PR",
  "CHR",
  "TR",
  "ACE",
  "AR",
  "SR",
  "SSR",
  "CSR",
  "HR",
  "SAR",
  "MA",
  "UR",
  "GRA",
  "BWR",
]);

const argv = process.argv.slice(2);
const targetSet = readArg("--set");
const allData = argv.includes("--all-data");
const includePlanned = argv.includes("--planned");
const showOk = argv.includes("--show-ok");
const concurrency = readPositiveInt("--concurrency", 3);

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

async function main() {
  const setCodes = getTargetSetCodes();
  const results = await runLimited(
    setCodes.map((setCode) => async () => auditSet(setCode)),
    concurrency,
  );

  let ok = 0;
  let warn = 0;
  let skip = 0;
  let error = 0;

  for (const result of results) {
    if (result.status === "ok") ok++;
    else if (result.status === "warn") warn++;
    else if (result.status === "skip") skip++;
    else error++;

    if (result.status === "ok" && !showOk) continue;

    const label = result.status.toUpperCase().padEnd(5);
    const shop = result.shopCode ? ` shop=${result.shopCode}` : "";
    console.log(
      `${label} ${result.setCode}${shop} local=${result.localCards}/${result.localMax} fullahead=${result.fullaheadCards}/${result.fullaheadMax}`,
    );

    if (result.error) console.log(`  error: ${result.error}`);
    if (result.localNumberGaps.length) console.log(`  local gaps: ${summarizeNumbers(result.localNumberGaps)}`);
    if (result.missingHighNumbers.length) {
      console.log("  missing high:");
      for (const item of result.missingHighNumbers) {
        console.log(`    #${item.number} ${item.rarity ?? "?"} ${item.priceJpy} JPY ${item.title} ${item.url}`);
      }
    }
    const lowMissing = result.missingNumbers.filter((item) => !result.missingHighNumbers.some((high) => high.number === item.number));
    if (lowMissing.length) console.log(`  missing low/other: ${summarizeNumbers(lowMissing.map((item) => item.number))}`);
    if (result.unpricedHighCards.length) {
      console.log(`  unpriced local high: ${result.unpricedHighCards.map((card) => `#${card.number} ${card.rarity}`).join(", ")}`);
    }
  }

  console.log(`\ncoverage audit: ok=${ok}, warn=${warn}, skip=${skip}, error=${error}, total=${results.length}`);
  if (warn > 0 || error > 0) process.exitCode = 1;
}

async function auditSet(setCode: string): Promise<AuditResult> {
  const dataPath = join(DATA_SETS_DIR, `${setCode}.json`);
  const base: AuditResult = {
    setCode,
    shopCode: null,
    status: "skip",
    localCards: 0,
    localMax: 0,
    localNumberGaps: [],
    fullaheadCards: 0,
    fullaheadMax: 0,
    missingNumbers: [],
    missingHighNumbers: [],
    unpricedHighCards: [],
  };

  if (!existsSync(dataPath)) return { ...base, status: "error", error: "missing local set file" };

  const set = readJson<SetJson>(dataPath);
  const numericCards = set.cards.filter((card) => typeof card.number === "number" && card.number > 0);
  const localNumbers = new Set(numericCards.map((card) => card.number as number));
  const localMax = numericCards.length ? Math.max(...numericCards.map((card) => card.number as number)) : 0;
  const localNumberGaps = range(1, localMax).filter((number) => !localNumbers.has(number));
  const unpricedHighCards = set.cards.filter((card) => isLocalHigh(card) && !isPriced(card));
  const shopCode = getShopCodeForSet(set);

  const hydrated: AuditResult = {
    ...base,
    shopCode,
    localCards: set.cards.length,
    localMax,
    localNumberGaps,
    unpricedHighCards,
  };

  if (!shopCode || set.type === "starter") {
    const hasProblems = localNumberGaps.length > 0 || unpricedHighCards.length > 0;
    return { ...hydrated, status: hasProblems ? "warn" : "skip" };
  }

  try {
    const items = await fetchFullaheadSetItems(shopCode);
    const byNumber = new Map<number, FullaheadItem>();
    for (const item of items) {
      const previous = byNumber.get(item.number);
      if (!previous || item.priceJpy > previous.priceJpy) byNumber.set(item.number, item);
    }
    const uniqueItems = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
    const missingNumbers = uniqueItems.filter((item) => !localNumbers.has(item.number));
    const missingHighNumbers = missingNumbers.filter((item) => isHighRarity(item.rarity));
    const fullaheadMax = uniqueItems.length ? Math.max(...uniqueItems.map((item) => item.number)) : 0;
    const hasProblems = localNumberGaps.length > 0 || missingHighNumbers.length > 0 || unpricedHighCards.length > 0;

    return {
      ...hydrated,
      status: hasProblems ? "warn" : "ok",
      fullaheadCards: uniqueItems.length,
      fullaheadMax,
      missingNumbers,
      missingHighNumbers,
    };
  } catch (errorValue) {
    return {
      ...hydrated,
      status: "error",
      error: errorValue instanceof Error ? errorValue.message : String(errorValue),
    };
  }
}

async function fetchFullaheadSetItems(shopCode: string): Promise<FullaheadItem[]> {
  const { categoryCode, firstHtml } = await fetchFirstCategoryPage(shopCode);
  const items = new Map<string, FullaheadItem>();

  for (const item of parseFullaheadItems(firstHtml, shopCode)) {
    items.set(`${item.number}-${item.priceJpy}-${item.title}`, item);
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
      items.set(`${item.number}-${item.priceJpy}-${item.title}`, item);
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
    } catch (errorValue) {
      lastError = errorValue;
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

function fullaheadCodePattern(shopCode: string): string {
  const escaped = escapeRegExp(shopCode.toUpperCase());
  return escaped.endsWith("PLUS") ? `${escaped.slice(0, -4)}(?:PLUS|\\+)` : escaped;
}

async function fetchEucJp(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PokeSimKR/1.0; +https://pokesim.kr)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
    },
  });
  if (!response.ok) throw new Error(`FullAhead ${url} returned ${response.status}`);
  return new TextDecoder("euc-jp").decode(await response.arrayBuffer());
}

function parseFullaheadItems(html: string, shopCode: string): FullaheadItem[] {
  const items: FullaheadItem[] = [];
  const codeRegex = new RegExp(`PK-${fullaheadCodePattern(shopCode)}-([0-9]{1,3})(?:-([0-9]{1,3}))?`, "i");
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
    const rangeEnd = codeMatch[2] ? Number(codeMatch[2]) : number;
    const priceJpy = Number(priceText.replace(/[^\d]/g, ""));
    if (
      !Number.isFinite(number)
      || !Number.isFinite(rangeEnd)
      || rangeEnd < number
      || !Number.isFinite(priceJpy)
      || priceJpy <= 0
    ) continue;

    for (let current = number; current <= rangeEnd; current++) {
      items.push({
        number: current,
        title,
        rarity: extractRarity(title),
        priceJpy,
        url: normalizeFullaheadUrl(href),
      });
    }
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
  const match = imageUrl?.match(/\/([A-Za-z0-9]+)_\d+(?:_[a-z])?\.(?:png|jpg|jpeg|webp)$/i);
  return match?.[1] ?? null;
}

function extractRarity(title: string): string | null {
  const normalized = title.toUpperCase();
  const match = normalized.match(/\b(BWR|MUR|GRA|SAR|CSR|CHR|SSR|AR|SR|HR|UR|ACE|TR|PR|K|S8AP|25TH|MA|A|S|RRR|RR|R|U|C)\b/);
  return match?.[1] ?? null;
}

function isHighRarity(rarity: string | null): boolean {
  return Boolean(rarity && HIGH_RARITIES.has(rarity));
}

function isLocalHigh(card: CardEntry): boolean {
  return isHighRarity(card.rarity ?? null);
}

function isPriced(card: CardEntry): boolean {
  return typeof card.price_ref_krw === "number" && card.price_ref_krw > 0;
}

function getTargetSetCodes(): string[] {
  if (targetSet) return targetSet.split(",").map((code) => code.trim()).filter(Boolean);
  if (allData) {
    return readdirSync(DATA_SETS_DIR)
      .filter((file: string) => file.endsWith(".json"))
      .map((file: string) => file.replace(/\.json$/, ""))
      .sort();
  }

  const index = readJson<SetsIndex>(SETS_INDEX_PATH);
  return [
    ...(index.active_sets ?? []),
    ...(includePlanned ? index.planned_sets ?? [] : []),
  ];
}

async function runLimited<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

function range(start: number, end: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value++) values.push(value);
  return values;
}

function summarizeNumbers(numbers: number[]): string {
  if (numbers.length <= 30) return numbers.join(",");
  return `${numbers.slice(0, 30).join(",")} ... +${numbers.length - 30}`;
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

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(readArg(name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
