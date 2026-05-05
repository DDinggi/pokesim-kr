/**
 * 수동 카드 추가 도우미.
 *
 * 사용:
 *   pnpm manual-add -- --set m4-ninja-spinner --tsv ../data/manual/m4-ninja-spinner-additions.tsv
 *
 * TSV 형식 (탭 구분, 첫 줄은 헤더):
 *   number  name_ko  rarity  card_type  subtype  hp  type  image_url  _source
 *
 * 빈 칼럼은 null. card_num은 기존 카드의 prefix를 따와 자동 생성.
 * image_url이 https://로 시작하면 외부 hotlink, 아니면 pokemonkorea CDN 상대경로로 간주.
 *
 * 같은 number의 카드가 이미 있으면 덮어쓰기 (중복 방지). _manual: true 플래그 부여.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

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
  _source?: string;
  _fetched_at?: string;
  _manual?: boolean;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function parseTSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (values[i] ?? "").trim()));
    return obj;
  });
}

function nullable(v: string): string | null {
  return v === "" ? null : v;
}

function nullableNum(v: string): number | null {
  return v === "" ? null : Number(v);
}

const setCode = arg("set");
const tsvArg = arg("tsv");
if (!setCode || !tsvArg) {
  console.error("Usage: pnpm manual-add -- --set <code> --tsv <tsv-path>");
  process.exit(1);
}

const tsvPath = resolve(process.cwd(), tsvArg);
const setPath = join(REPO_ROOT, "data", "sets", `${setCode}.json`);

const tsvText = readFileSync(tsvPath, "utf-8");
const rows = parseTSV(tsvText);
if (rows.length === 0) {
  console.error("TSV is empty or has no data rows.");
  process.exit(1);
}

const setData = JSON.parse(readFileSync(setPath, "utf-8")) as { cards: Card[] };
const firstCardNum = setData.cards[0]?.card_num ?? "";
const prefix = firstCardNum.slice(0, -3);
if (!prefix) {
  console.error(`Cannot infer card_num prefix from ${setCode}.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const newCards: Card[] = rows.map((r) => {
  const number = Number(r.number);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid number: ${JSON.stringify(r)}`);
  }
  return {
    card_num: `${prefix}${String(number).padStart(3, "0")}`,
    number,
    name_ko: nullable(r.name_ko ?? ""),
    rarity: nullable(r.rarity ?? ""),
    card_type: nullable(r.card_type ?? ""),
    subtype: nullable(r.subtype ?? ""),
    hp: nullableNum(r.hp ?? ""),
    type: nullable(r.type ?? ""),
    image_url: r.image_url ?? "",
    _source: nullable(r._source ?? "") ?? undefined,
    _fetched_at: today,
    _manual: true,
  };
});

// Replace any existing cards with same number (manual overwrite wins)
const newNumbers = new Set(newCards.map((c) => c.number));
setData.cards = setData.cards.filter((c) => !newNumbers.has(c.number));
setData.cards.push(...newCards);
setData.cards.sort((a, b) => a.number - b.number);

writeFileSync(setPath, JSON.stringify(setData, null, 2) + "\n", "utf-8");

const manualCount = setData.cards.filter((c) => c._manual).length;
console.log(
  `Added/updated ${newCards.length} manual cards. Total: ${setData.cards.length} (${manualCount} manual). Saved → ${setPath}`,
);
