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
  "S",
  "A",
  "25TH",
  "S8AP",
  "K",
  "CHR",
  "TR",
  "ACE",
  "AR",
  "CHR",
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
const HIGH_RARITIES = new Set(["RRR", "S", "A", "25TH", "S8AP", "K", "CHR", "TR", "ACE", "AR", "SR", "SSR", "CSR", "HR", "SAR", "MA", "UR", "GRA", "BWR"]);
const START_DECK_100_REP_NUMBERS = [
  85, 204, 437, 146, 68, 18, 151, 94, 185, 204,
  3, 470, 380, 374, 169, 192, 746, 208, 750, 68,
  290, 82, 205, 259, 764, 437, 227, 284, 370, 351,
  42, 765, 113, 753, 287, 129, 747, 68, 147, 755,
  756, 297, 154, 126, 758, 380, 82, 425, 312, 71,
  77, 512, 353, 227, 744, 169, 429, 77, 749, 36,
  364, 394, 237, 759, 192, 378, 38, 514, 82, 754,
  64, 227, 132, 751, 192, 478, 752, 282, 222, 757,
  486, 85, 743, 203, 44, 284, 380, 583, 748, 113,
  208, 22, 745, 18, 760, 149, 284, 77, 126, 233,
];
const START_DECK_100_SPECIAL_REP_NUMBERS = [761, 762, 763];
const START_DECK_100_GOLD_REP_NUMBERS = [766];

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
  start_deck?: StartDeckMeta;
}

interface StartDeckMeta {
  deck_count?: number;
  special_deck_no?: number;
  special_deck_rate?: number;
  gold_deck_no?: number;
  gold_deck_rate?: number;
  rep_card_nums?: string[];
  special_rep_card_nums?: string[];
  gold_rep_card_nums?: string[];
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
const ALLOWED_EXTERNAL_IMAGE_PREFIXES = [
  "https://www.pokemon-card.com/assets/images/card_images/",
  "https://primary.jwwb.nl/public/",
];

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

  // 스타트 덱(starter)은 카드에 rarity 표기가 없는 구축 덱 제품이라 고레어/UR 검사를 건너뛴다.
  const isStarter = set.type === "starter";

  if (!isStarter && cards.length > 0 && highCount === 0) {
    const level: Level = isActive ? "warn" : "info";
    add(level, setCode, "AR/SR/SAR/UR/BWR 등 고레어 카드가 하나도 없습니다.");
  }

  if (!isStarter && isMegaSet(set, setCode) && cards.length > 0 && !rarityCounts.UR) {
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
  if (cards.length > 0 && nullCount / cards.length > 0.5 && set.type !== "hi-class" && !isStarter && setCode !== "s8a-25th-anniversary") {
    add("warn", setCode, `rarity null이 ${nullCount}/${cards.length}장입니다. 의도된 병렬/리버스 카드인지 확인이 필요합니다.`);
  }

  validateDuplicates(setCode, cards);
  validateNumberContinuity(setCode, cards);
  validateImages(setCode, cards);
  validateImageNumberAlignment(setCode, cards);
  validateStartDeck(setCode, set, cards);
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

  const unexpectedMissing = missing.filter((number) => !getAllowedMissingNumbers(setCode).has(number));

  if (unexpectedMissing.length > 0) {
    add(
      "warn",
      setCode,
      `number가 연속되지 않습니다. 누락 범위 예: ${compactNumbers(unexpectedMissing.slice(0, 30))}${unexpectedMissing.length > 30 ? " ..." : ""}`,
    );
  }
}

function getAllowedMissingNumbers(setCode: string): Set<number> {
  if (setCode === "s8b-vmax-climax") {
    return new Set([57, 58, 59, 226, 227, 228, 229]);
  }

  if (setCode === "s8a-25th-anniversary") {
    return new Set([25, 26, 27, 28, 29, 30]);
  }

  return new Set();
}

function validateImages(setCode: string, cards: CardEntry[]) {
  for (const card of cards) {
    if (!card.image_url) {
      add("warn", setCode, `${card.card_num ?? card.number ?? "unknown"} image_url이 없습니다.`);
      continue;
    }

    if (
      /^https?:\/\//.test(card.image_url) &&
      !ALLOWED_EXTERNAL_IMAGE_PREFIXES.some((prefix) => card.image_url?.startsWith(prefix))
    ) {
      add("warn", setCode, `${card.card_num ?? card.number ?? "unknown"} image_url이 외부 절대 URL입니다.`);
    }
  }
}

function validateImageNumberAlignment(setCode: string, cards: CardEntry[]) {
  for (const card of cards) {
    if (!Number.isInteger(card.number) || !card.image_url?.includes("wmimages/")) continue;

    const imageNumber = card.image_url.match(/_(\d+)(?:_m)?\.[a-z0-9]+$/i)?.[1];
    if (imageNumber && Number(imageNumber) !== card.number) {
      add(
        "warn",
        setCode,
        `${card.card_num ?? card.number ?? "unknown"} image number ${imageNumber} does not match card number ${card.number}.`,
      );
    }
  }
}

function validateStartDeck(setCode: string, set: SetJson, cards: CardEntry[]) {
  if (set.type !== "starter") return;

  const meta = set.start_deck;
  if (!meta) {
    add("error", setCode, "starter set is missing start_deck metadata.");
    return;
  }

  const byCardNum = new Map(cards.filter((card) => card.card_num).map((card) => [card.card_num, card]));
  const byNumber = new Map(cards.filter((card) => Number.isInteger(card.number)).map((card) => [card.number, card]));
  const repCardNums = meta.rep_card_nums ?? [];
  const specialRepCardNums = meta.special_rep_card_nums ?? [];
  const goldRepCardNums = meta.gold_rep_card_nums ?? [];

  for (const cardNum of [...repCardNums, ...specialRepCardNums, ...goldRepCardNums]) {
    if (!byCardNum.has(cardNum)) {
      add("error", setCode, `start_deck references missing card_num ${cardNum}.`);
    }
  }

  const duplicatedRepCardNums = Object.entries(countBy(repCardNums, (cardNum) => cardNum)).filter(([, count]) => count > 1);
  if (duplicatedRepCardNums.length > 0) {
    add("info", setCode, `start_deck representative cards repeat: ${duplicatedRepCardNums.slice(0, 8).map(([key, count]) => `${key}x${count}`).join(", ")}`);
  }

  if (setCode !== "m-start-deck-100") return;

  if (meta.deck_count !== 102) {
    add("error", setCode, `expected deck_count 102, got ${meta.deck_count ?? "missing"}.`);
  }

  if (meta.special_deck_no !== 101) {
    add("error", setCode, `expected special_deck_no 101, got ${meta.special_deck_no ?? "missing"}.`);
  }

  if (meta.gold_deck_no !== 1) {
    add("error", setCode, `expected gold_deck_no 1, got ${meta.gold_deck_no ?? "missing"}.`);
  }

  if (repCardNums.length !== START_DECK_100_REP_NUMBERS.length) {
    add("error", setCode, `expected ${START_DECK_100_REP_NUMBERS.length} normal deck representatives, got ${repCardNums.length}.`);
  }

  START_DECK_100_REP_NUMBERS.forEach((expectedNumber, index) => {
    const card = byCardNum.get(repCardNums[index]);
    if (card && card.number !== expectedNumber) {
      add("error", setCode, `Deck No.${String(index + 1).padStart(3, "0")} representative should be #${expectedNumber}, got #${card.number}.`);
    }

    if (!byNumber.has(expectedNumber)) {
      add("error", setCode, `expected representative card #${expectedNumber} is missing from cards.`);
    }
  });

  const specialNumbers = specialRepCardNums.map((cardNum) => byCardNum.get(cardNum)?.number);
  if (specialNumbers.join(",") !== START_DECK_100_SPECIAL_REP_NUMBERS.join(",")) {
    add("error", setCode, `Deck No.101 representatives should be #${START_DECK_100_SPECIAL_REP_NUMBERS.join(",")}, got #${specialNumbers.join(",")}.`);
  }

  const goldNumbers = goldRepCardNums.map((cardNum) => byCardNum.get(cardNum)?.number);
  if (goldNumbers.join(",") !== START_DECK_100_GOLD_REP_NUMBERS.join(",")) {
    add("error", setCode, `Gold Deck No.001 representatives should be #${START_DECK_100_GOLD_REP_NUMBERS.join(",")}, got #${goldNumbers.join(",")}.`);
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
