import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import simulatorDefault from "../frontend/lib/simulator.ts";
import type { Card, SetMeta } from "../frontend/lib/types.ts";

const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import("../frontend/lib/simulator.ts");

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_IMAGE_BASE = "https://img.pokesim.kr";
const KOREA_IMAGE_BASE = "https://cards.image.pokemonkorea.co.kr/data/";

type ExpectedSetShape = {
  total: number;
  rangeEnd: number;
  rarityCounts: Record<string, number>;
  highRanges: Record<string, Array<[number, number]>>;
  altSrRanges: Array<[number, number]>;
};

const EXPECTED: Record<string, ExpectedSetShape> = {
  "s6h-silver-lance": {
    total: 95,
    rangeEnd: 95,
    rarityCounts: { C: 30, U: 23, R: 8, RR: 6, RRR: 3, SR: 13, HR: 8, UR: 4 },
    highRanges: { SR: [[71, 83]], HR: [[84, 91]], UR: [[92, 95]] },
    altSrRanges: [[73, 73], [75, 75], [79, 79]],
  },
  "s6a-eevee-heroes": {
    total: 101,
    rangeEnd: 101,
    rarityCounts: { C: 28, U: 21, R: 8, RR: 8, RRR: 4, SR: 18, HR: 10, UR: 4 },
    highRanges: { SR: [[70, 87]], HR: [[88, 97]], UR: [[98, 101]] },
    altSrRanges: [[71, 71], [73, 73], [75, 75], [77, 77], [79, 79], [81, 81], [83, 83], [85, 85]],
  },
};

const RATE_ORDER = ["SR_ALT", "SR", "HR", "UR", "UR_LOW", "CSR", "SAR", "GRA", "BWR", "RRR", "RR", "R"];
const HIGH_RARITIES = new Set(["SR", "HR", "UR", "CSR", "SAR", "GRA", "BWR"]);

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = arg(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadSet(code: string, source: "data" | "public" = "data"): SetMeta {
  const path = source === "data"
    ? resolve(ROOT_DIR, "data", "sets", `${code}.json`)
    : resolve(ROOT_DIR, "frontend", "public", "sets", `${code}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as SetMeta;
}

function countBy<T extends string | number>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[String(value)] = (counts[String(value)] ?? 0) + 1;
  return counts;
}

function isInRanges(number: number, ranges: Array<[number, number]> | undefined): boolean {
  return Boolean(ranges?.some(([start, end]) => number >= start && number <= end));
}

function isLowScoreUrSet(setCode: string): boolean {
  return !setCode.startsWith("m")
    && !setCode.includes("25th")
    && !setCode.includes("start-deck");
}

function scoreKeyForCard(card: Card, setCode: string): string | null {
  if (!card.rarity) return null;
  if (isLowScoreUrSet(setCode) && card.rarity === "UR" && card.card_type !== "포켓몬") return "UR_LOW";
  if (card.rarity === "SR" && card.card_type === "포켓몬" && isInRanges(card.number, EXPECTED[setCode]?.altSrRanges)) {
    return "SR_ALT";
  }
  return card.rarity;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function hostOf(url: string | undefined): string {
  if (!url) return "unknown";
  if (!/^https?:\/\//.test(url)) return url.split("/")[0] || "local";
  return url.replace(/^https?:\/\/([^/]+).*$/, "$1");
}

function noExt(path: string): string {
  return path.replace(/\.[a-zA-Z0-9]+$/, "");
}

function originalKeyFor(card: Card): string {
  return card.image_url.replace(/^\/+/, "");
}

function variantUrlFor(card: Card, size: 256 | 512): string {
  return `${PUBLIC_IMAGE_BASE}/cards/${size}/${noExt(originalKeyFor(card))}.webp`;
}

function sourceImageUrlFor(card: Card & Record<string, unknown>): string | null {
  const imageSourceUrl = typeof card._image_source_url === "string" ? card._image_source_url : null;
  if (imageSourceUrl && /^https?:\/\//.test(imageSourceUrl)) return imageSourceUrl;

  const source = typeof card._source === "string" ? card._source : null;
  if (source && /^https?:\/\/.*\.(png|jpe?g|webp)(\?|#|$)/i.test(source)) return source;

  if (card.image_url?.startsWith("wmimages/")) return `${KOREA_IMAGE_BASE}${card.image_url}`;
  if (/^https?:\/\//.test(card.image_url)) return card.image_url;
  if (card.image_url?.startsWith("external/")) return `${PUBLIC_IMAGE_BASE}/${card.image_url}`;
  return null;
}

function compareCounts(
  label: string,
  actual: Record<string, number>,
  expected: Record<string, number>,
  problems: string[],
): void {
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key] ?? 0;
    if (actualValue !== expectedValue) {
      problems.push(`${label} ${key}: expected ${expectedValue}, got ${actualValue}`);
    }
  }
}

function auditShape(set: SetMeta, expected: ExpectedSetShape | undefined): string[] {
  const problems: string[] = [];
  const numbers = set.cards.map((card) => card.number).sort((a, b) => a - b);
  const duplicates = Object.entries(countBy(numbers)).filter(([, count]) => count > 1).map(([number]) => number);
  const rangeEnd = expected?.rangeEnd ?? Math.max(...numbers);
  const missing: number[] = [];
  for (let n = 1; n <= rangeEnd; n++) {
    if (!numbers.includes(n)) missing.push(n);
  }

  if (expected && set.cards.length !== expected.total) problems.push(`card total: expected ${expected.total}, got ${set.cards.length}`);
  if (missing.length) problems.push(`missing numbers: ${missing.join(",")}`);
  if (duplicates.length) problems.push(`duplicate numbers: ${duplicates.join(",")}`);

  const rarityCounts = countBy(set.cards.map((card) => card.rarity ?? "null"));
  if (expected) compareCounts("rarity", rarityCounts, expected.rarityCounts, problems);

  for (const [rarity, ranges] of Object.entries(expected?.highRanges ?? {})) {
    for (const card of set.cards.filter((c) => isInRanges(c.number, ranges))) {
      if (card.rarity !== rarity) problems.push(`#${card.number} should be ${rarity}, got ${card.rarity ?? "null"}`);
    }
  }

  return problems;
}

function highCards(set: SetMeta): Array<Card & Record<string, unknown>> {
  return set.cards.filter((card) => card.rarity && HIGH_RARITIES.has(card.rarity)) as Array<Card & Record<string, unknown>>;
}

function printSourceSummary(set: SetMeta): void {
  const cards = highCards(set);
  const hosts = countBy(cards.map((card) => hostOf((card._image_source_url as string | undefined) ?? (card._source as string | undefined) ?? card.image_url)));
  console.log(`  high-card source hosts: ${Object.entries(hosts).map(([host, count]) => `${host}=${count}`).join(", ")}`);

  const altCards = set.cards.filter((card) => scoreKeyForCard(card, set.code) === "SR_ALT");
  if (altCards.length) {
    console.log(`  SR_ALT/특일: ${altCards.map((card) => `#${String(card.number).padStart(3, "0")} ${card.name_ko ?? ""}`).join(" · ")}`);
  }
}

function simulateRates(set: SetMeta, boxTrials: number, packTrials: number): void {
  const boxTotals: Record<string, number> = {};
  for (let i = 0; i < boxTrials; i++) {
    const result = simulateBox(set.cards, set.box_size, set.type, set.pack_size, undefined, set.code);
    for (const pack of result.packs) {
      for (const card of pack.cards) {
        const key = scoreKeyForCard(card, set.code);
        if (key) boxTotals[key] = (boxTotals[key] ?? 0) + 1;
      }
    }
  }

  const packTotals: Record<string, number> = {};
  for (let i = 0; i < packTrials; i++) {
    const result = simulatePack(set.cards, set.type, set.pack_size, undefined, set.code);
    for (const card of result.pack.cards) {
      const key = scoreKeyForCard(card, set.code);
      if (key) packTotals[key] = (packTotals[key] ?? 0) + 1;
    }
  }

  console.log(`  simulated rates: boxes=${boxTrials.toLocaleString()}, packs=${packTrials.toLocaleString()}`);
  for (const key of RATE_ORDER) {
    const perBox = (boxTotals[key] ?? 0) / boxTrials;
    const perPack = (packTotals[key] ?? 0) / packTrials;
    if (perBox > 0 || perPack > 0) {
      console.log(`    ${key.padEnd(6)} ${perBox.toFixed(4).padStart(7)} / box | ${fmtPct(perPack).padStart(7)} / pack`);
    }
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function checkVariantImages(set: SetMeta, concurrency: number): Promise<string[]> {
  const checks = set.cards.flatMap((card) => [256, 512].map((size) => ({ card, size: size as 256 | 512 })));
  const failures = await mapLimit(checks, concurrency, async ({ card, size }) => {
    const url = variantUrlFor(card, size);
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok ? null : `#${card.number} ${size}px ${res.status} ${url}`;
    } catch (error) {
      return `#${card.number} ${size}px ${(error as Error).message}`;
    }
  });
  return failures.filter(Boolean) as string[];
}

async function checkSourceImages(set: SetMeta, concurrency: number): Promise<string[]> {
  const cards = highCards(set);
  const warnings = await mapLimit(cards, concurrency, async (card) => {
    const url = sourceImageUrlFor(card);
    if (!url) return `#${card.number} no source image url`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "PokeSim KR data audit (+https://pokesim.kr)",
          Referer: "https://pokesim.kr/",
        },
      });
      if (!res.ok) return `#${card.number} source HTTP ${res.status} ${url}`;
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      const minSide = Math.min(width, height);
      if (minSide < 450) return `#${card.number} low source resolution ${width}x${height} ${url}`;
      return null;
    } catch (error) {
      return `#${card.number} source ${(error as Error).message}`;
    }
  });
  return warnings.filter(Boolean) as string[];
}

async function main() {
  const setArg = arg("set") ?? "s6h-silver-lance,s6a-eevee-heroes";
  const setCodes = setArg.split(",").map((code) => code.trim()).filter(Boolean);
  const boxTrials = readPositiveInt("box-trials", 2000);
  const packTrials = readPositiveInt("pack-trials", 20000);
  const concurrency = readPositiveInt("concurrency", 6);
  const shouldCheckImages = hasFlag("check-images");
  const shouldCheckSourceImages = hasFlag("check-source-images");
  let failed = false;

  for (const code of setCodes) {
    const set = loadSet(code, "data");
    console.log(`\n=== ${code} | ${set.name_ko} ===`);
    const shapeProblems = auditShape(set, EXPECTED[code]);
    if (shapeProblems.length) {
      failed = true;
      console.log("  shape: FAIL");
      for (const problem of shapeProblems) console.log(`    - ${problem}`);
    } else {
      console.log("  shape: ok");
    }

    printSourceSummary(set);
    simulateRates(set, boxTrials, packTrials);

    if (shouldCheckImages) {
      const failures = await checkVariantImages(set, concurrency);
      if (failures.length) {
        failed = true;
        console.log("  256/512 variants: FAIL");
        for (const failure of failures.slice(0, 20)) console.log(`    - ${failure}`);
        if (failures.length > 20) console.log(`    ... ${failures.length - 20} more`);
      } else {
        console.log("  256/512 variants: ok");
      }
    }

    if (shouldCheckSourceImages) {
      const warnings = await checkSourceImages(set, concurrency);
      if (warnings.length) {
        failed = true;
        console.log("  source images: WARN");
        for (const warning of warnings.slice(0, 20)) console.log(`    - ${warning}`);
        if (warnings.length > 20) console.log(`    ... ${warnings.length - 20} more`);
      } else {
        console.log("  source images: ok");
      }
    }
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
