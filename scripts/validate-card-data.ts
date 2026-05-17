#!/usr/bin/env tsx

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(REPO_ROOT, "data", "sets");
const PUBLIC_SETS_DIR = join(REPO_ROOT, "frontend", "public", "sets");
const SETS_INDEX = join(REPO_ROOT, "data", "sets-index.json");

const KNOWN_RARITIES = new Set([
  "C",
  "U",
  "R",
  "RR",
  "RRR",
  "K",
  "ACE",
  "AR",
  "SR",
  "SSR",
  "SAR",
  "MA",
  "UR",
  "BWR",
]);
const HIGH_RARITIES = new Set(["RRR", "K", "ACE", "AR", "SR", "SSR", "SAR", "MA", "UR", "BWR"]);

interface CardEntry {
  card_num?: string;
  number?: number | null;
  name_ko?: string | null;
  rarity?: string | null;
  card_type?: string | null;
  image_url?: string | null;
}

interface SetJson {
  code?: string;
  name_ko?: string;
  series?: string;
  type?: string;
  rarities?: string[];
  cards?: CardEntry[];
}

interface SetsIndex {
  active_sets?: string[];
  planned_sets?: string[];
}

type Level = "error" | "warn" | "info";

interface Finding {
  level: Level;
  set: string;
  message: string;
}

const argv = process.argv.slice(2);
const targetSet = readArg("--set");
const jsonOutput = argv.includes("--json");
const strict = argv.includes("--strict");

const findings: Finding[] = [];

main();

function main() {
  const index = readJson<SetsIndex>(SETS_INDEX);
  const activeSets = new Set(index.active_sets ?? []);
  const plannedSets = new Set(index.planned_sets ?? []);
  const files = readdirSync(DATA_SETS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !targetSet || file === `${targetSet}.json`)
    .sort();

  for (const file of files) {
    validateSet(file, activeSets, plannedSets);
  }

  for (const setCode of activeSets) {
    const filePath = join(DATA_SETS_DIR, `${setCode}.json`);
    if (!existsSync(filePath)) {
      add("error", setCode, "active_sets에 있지만 data/sets 파일이 없습니다.");
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    printFindings(findings);
  }

  const hasError = findings.some((finding) => finding.level === "error");
  const hasWarning = findings.some((finding) => finding.level === "warn");

  if (hasError || (strict && hasWarning)) {
    process.exitCode = 1;
  }
}

function validateSet(file: string, activeSets: Set<string>, plannedSets: Set<string>) {
  const filePath = join(DATA_SETS_DIR, file);
  const setCode = file.replace(/\.json$/, "");
  const set = readJson<SetJson>(filePath);
  const cards = set.cards ?? [];
  const isActive = activeSets.has(setCode);
  const isPlanned = plannedSets.has(setCode);
  const rarityCounts = countBy(cards, (card) => card.rarity ?? "__null__");
  const highCount = cards.filter((card) => card.rarity && HIGH_RARITIES.has(card.rarity)).length;

  if (set.code !== setCode) {
    add("error", setCode, `code 필드(${set.code ?? "없음"})가 파일명과 다릅니다.`);
  }

  if (isActive && cards.length === 0) {
    add("error", setCode, "active_sets에 있는데 cards가 비어 있습니다.");
  } else if (!isActive && cards.length === 0) {
    add("info", setCode, "placeholder 세트입니다. active_sets에 넣기 전 카드 수집이 필요합니다.");
  }

  if (cards.length > 0 && highCount === 0) {
    const level: Level = isActive ? "warn" : "info";
    add(level, setCode, "AR/SR/SAR/UR/BWR 등 고레어 카드가 하나도 없습니다.");
  }

  if (isMegaSet(set, setCode) && cards.length > 0 && !rarityCounts.UR) {
    add("warn", setCode, "MEGA 세트인데 UR(MUR 정규화) 카드가 없습니다. MUR 누락 가능성이 큽니다.");
  }

  if ((setCode === "sv11a-white-flare" || setCode === "sv11b-black-bolt") && rarityCounts.BWR !== 1) {
    add("warn", setCode, `BWR 기대값은 1장인데 현재 ${rarityCounts.BWR ?? 0}장입니다.`);
  }

  for (const rarity of Object.keys(rarityCounts)) {
    if (rarity !== "__null__" && !KNOWN_RARITIES.has(rarity)) {
      add("warn", setCode, `알 수 없는 rarity '${rarity}'가 있습니다.`);
    }
  }

  const nullCount = rarityCounts.__null__ ?? 0;
  if (cards.length > 0 && nullCount / cards.length > 0.5 && set.type !== "hi-class") {
    add("warn", setCode, `rarity null이 ${nullCount}/${cards.length}장입니다. 의도된 병렬/리버스 카드인지 확인이 필요합니다.`);
  }

  validateDuplicates(setCode, cards);
  validateNumberContinuity(setCode, cards);
  validateImages(setCode, cards);
  validatePublicCopy(setCode, filePath);

  if (!isActive && !isPlanned && cards.length > 0 && set.type !== "promo") {
    add("info", setCode, "카드 데이터는 있지만 sets-index의 active/planned 어디에도 없습니다.");
  }
}

function validateDuplicates(setCode: string, cards: CardEntry[]) {
  const cardNums = countBy(cards, (card) => card.card_num ?? "__missing__");
  const duplicateCardNums = Object.entries(cardNums).filter(([, count]) => count > 1);

  if (duplicateCardNums.length > 0) {
    add(
      "error",
      setCode,
      `중복 card_num: ${duplicateCardNums.slice(0, 8).map(([key, count]) => `${key}x${count}`).join(", ")}`,
    );
  }

  const numbers = countBy(cards.filter((card) => Number.isInteger(card.number)), (card) => String(card.number));
  const duplicateNumbers = Object.entries(numbers).filter(([, count]) => count > 1);

  if (duplicateNumbers.length > 0) {
    add(
      "info",
      setCode,
      `중복 number가 있습니다: ${duplicateNumbers.slice(0, 10).map(([key, count]) => `${key}x${count}`).join(", ")}${duplicateNumbers.length > 10 ? " ..." : ""}`,
    );
  }
}

function validateNumberContinuity(setCode: string, cards: CardEntry[]) {
  const numbers = cards
    .map((card) => card.number)
    .filter((number): number is number => Number.isInteger(number))
    .sort((a, b) => a - b);

  if (numbers.length === 0) return;

  const unique = new Set(numbers);
  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const missing: number[] = [];

  for (let number = min; number <= max; number += 1) {
    if (!unique.has(number)) {
      missing.push(number);
    }
  }

  if (missing.length > 0) {
    add(
      "warn",
      setCode,
      `number가 연속되지 않습니다. 누락 범위 예: ${compactNumbers(missing.slice(0, 30))}${missing.length > 30 ? " ..." : ""}`,
    );
  }
}

function validateImages(setCode: string, cards: CardEntry[]) {
  for (const card of cards) {
    if (!card.image_url) {
      add("warn", setCode, `${card.card_num ?? card.number ?? "unknown"} image_url이 없습니다.`);
      continue;
    }

    if (/^https?:\/\//.test(card.image_url)) {
      add("warn", setCode, `${card.card_num ?? card.number ?? "unknown"} image_url이 외부 절대 URL입니다.`);
    }
  }
}

function validatePublicCopy(setCode: string, dataFilePath: string) {
  const publicPath = join(PUBLIC_SETS_DIR, `${setCode}.json`);

  if (!existsSync(publicPath)) {
    add("error", setCode, "frontend/public/sets 복사본이 없습니다.");
    return;
  }

  if (readFileSync(dataFilePath, "utf8") !== readFileSync(publicPath, "utf8")) {
    add("error", setCode, "data/sets와 frontend/public/sets 내용이 다릅니다. pnpm sync가 필요합니다.");
  }
}

function isMegaSet(set: SetJson, setCode: string) {
  return set.series === "MEGA" || setCode.startsWith("m-") || /^m\d+-/.test(setCode);
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

function compactNumbers(numbers: number[]) {
  return numbers.join(",");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function add(level: Level, set: string, message: string) {
  findings.push({ level, set, message });
}

function printFindings(items: Finding[]) {
  if (items.length === 0) {
    console.log("Card data validation passed.");
    return;
  }

  const rank: Record<Level, number> = { error: 0, warn: 1, info: 2 };
  const sorted = [...items].sort((a, b) => rank[a.level] - rank[b.level] || a.set.localeCompare(b.set));

  for (const finding of sorted) {
    console.log(`[${finding.level}] ${finding.set}: ${finding.message}`);
  }

  const errors = items.filter((item) => item.level === "error").length;
  const warnings = items.filter((item) => item.level === "warn").length;
  const info = items.filter((item) => item.level === "info").length;

  console.log(`\nsummary: ${errors} errors, ${warnings} warnings, ${info} info`);
}

function readArg(name: string) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}
