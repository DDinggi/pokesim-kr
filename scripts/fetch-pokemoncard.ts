#!/usr/bin/env tsx
/**
 * Usage (scripts/ 디렉터리에서):
 *   pnpm fetch -- --set m4-ninja-spinner
 *   pnpm fetch -- --set m4-ninja-spinner --dry-run
 *   pnpm fetch -- --set m4-ninja-spinner --merge
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseHtml } from "node-html-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const BASE_URL = "https://pokemoncard.co.kr";
const CDN_BASE = "https://cards.image.pokemonkorea.co.kr/data/";
const PAGE_SIZE = 30;
const DEFAULT_DELAY_MS = 1200;

// ── CLI args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};
const hasFlag = (name: string) => argv.includes(`--${name}`);

const setCode = getArg("set");
const searchTextOverride = getArg("search-text");
const dryRun = hasFlag("dry-run");
const merge = hasFlag("merge");
const delayMsArg = Number(getArg("delay-ms"));
const delayMs = Number.isFinite(delayMsArg) && delayMsArg >= 0 ? delayMsArg : DEFAULT_DELAY_MS;

if (!setCode) {
  console.error("Usage: pnpm fetch -- --set <set-code> [--dry-run] [--merge]");
  process.exit(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface SetJson {
  name_ko: string;
  rarities: string[];
  cards: CardEntry[];
  _fetched_at: string;
  [key: string]: unknown;
}

interface SearchResult {
  CardNum: string;
  feature_image: string;
}

interface CardEntry {
  card_num: string;
  number: number | null;
  name_ko: string | null;
  rarity: string | null;
  card_type: "포켓몬" | "트레이너" | "에너지" | null;
  subtype: string | null;
  hp: number | null;
  type: string | null;
  image_url: string;
  _source: string;
  _fetched_at: string;
  [key: string]: unknown;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stripPhpNotices(text: string): string {
  const i = text.indexOf("{");
  return i === -1 ? text : text.slice(i);
}

// ── API ───────────────────────────────────────────────────────────────────────
interface SearchPage {
  count: number;
  limit: number; // cursor for next request
  results: SearchResult[];
}

async function searchPage(
  searchText: string,
  limitCursor: number
): Promise<SearchPage> {
  // 사이트 JS와 동일하게 multipart/form-data (FormData)로 전송
  const formData = new FormData();
  formData.append("action", "search_text_cards");
  formData.append("search_text", searchText);
  formData.append("search_params", "all"); // 검색 대상: all/cardname/cardtext
  formData.append("limit", String(limitCursor));

  const res = await fetch(`${BASE_URL}/v2/ajax2_dev2`, {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE_URL}/cards`,
    },
    body: formData,
  });

  const text = await res.text();
  const json = stripPhpNotices(text);

  let data: { status: boolean; count: number; limit: number; result?: Record<string, SearchResult> };
  try {
    data = JSON.parse(json);
  } catch {
    console.error("JSON parse error. Raw:", text.slice(0, 300));
    return { count: 0, limit: 0, results: [] };
  }

  const results = data.result ? (Object.values(data.result) as SearchResult[]) : [];
  return { count: data.count ?? 0, limit: data.limit ?? 0, results };
}

function getFilePrefix(imageUrl: string): string | null {
  const clean = imageUrl.replace(/\?.*$/, "");
  const match = clean.match(/\/([A-Za-z0-9]+)_\d+\.(?:png|jpg|jpeg|webp)$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

async function fetchAllRefs(
  setName: string,
  folderPrefix: string,
  filePrefix: string | null
): Promise<SearchResult[]> {
  const all: SearchResult[] = [];
  // 첫 호출은 limit=0 (사이트 JS의 "start fresh" 규약)
  let cursor = 0;

  while (true) {
    process.stdout.write(`  cursor=${cursor}…`);
    const page = await searchPage(setName, cursor);
    const filtered = filePrefix
      ? page.results.filter((r) => getFilePrefix(r.feature_image) === filePrefix)
      : (folderPrefix ? page.results.filter((r) => r.feature_image.includes(folderPrefix)) : page.results);

    all.push(...filtered);
    console.log(` count=${page.count} +${filtered.length} (${all.length} total)`);

    if (page.count === 0) break;
    cursor = page.limit; // 서버가 내려준 next cursor
    await sleep(delayMs);
  }

  return all;
}

// ── HTML Parsing ──────────────────────────────────────────────────────────────
function parseCardDetail(
  html: string,
  cardNum: string,
  rarities: string[],
  fallbackImageUrl: string
): Omit<CardEntry, "card_num" | "_source" | "_fetched_at"> {
  const root = parseHtml(html);

  // 카드 이름
  const name_ko =
    root.querySelector(".detail_wrap .header .card-hp.title")?.text.trim() ??
    null;

  // HP (포켓몬만)
  const hpRaw = root.querySelector(".hp_num")?.text.trim();
  const hp = hpRaw ? parseInt(hpRaw.replace("HP", ""), 10) || null : null;

  // 레어도 — #no_wrap_by_admin 안에 " C " / " RR " 등
  const rarityRaw = root.querySelector("#no_wrap_by_admin")?.text ?? "";
  // 긴 코드 먼저 매칭 (SAR > SR > R 등 순서 중요)
  const knownRarities = [...rarities].sort((a, b) => b.length - a.length);
  const rarity = knownRarities.find((r) => {
    const escaped = r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(rarityRaw);
  }) ?? null;

  // 세트 내 번호 — "001/083" 중 앞 부분
  const pNumText = root.querySelector(".p_num")?.text ?? "";
  const numMatch = pNumText.match(/(\d+)\//);
  const number = numMatch ? parseInt(numMatch[1], 10) : null;

  // 카드 종류 (.pokemon-info)
  const infoText = root.querySelector(".pokemon-info")?.text ?? "";
  let card_type: CardEntry["card_type"] = null;
  if (infoText.includes("포켓몬")) card_type = "포켓몬";
  else if (infoText.includes("에너지")) card_type = "에너지";
  else if (
    infoText.includes("지지자") ||
    infoText.includes("도구") ||
    infoText.includes("스타디움") ||
    infoText.includes("트레이너") ||
    infoText.includes("카드 종류")
  )
    card_type = "트레이너";

  // 포켓몬 타입 — header 영역 첫 번째 .type_b[title]
  const typeImg = root
    .querySelectorAll(".detail_wrap .header img.type_b")
    .find((el) => el.getAttribute("title"));
  const type = typeImg?.getAttribute("title") ?? null;

  // 이미지 URL — .feature_image src (CDN base 제거, 쿼리스트링 제거)
  const imgSrc =
    root.querySelector(".feature_image")?.getAttribute("src") ?? "";
  const image_url = imgSrc
    ? imgSrc.replace(CDN_BASE, "").replace(/\?.*$/, "")
    : fallbackImageUrl;

  return { number, name_ko, rarity, card_type, subtype: null, hp, type, image_url };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dataPath = join(REPO_ROOT, "data", "sets", `${setCode}.json`);
  const setData: SetJson = JSON.parse(readFileSync(dataPath, "utf8"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  console.log(`\nSet : ${setData.name_ko}`);
  console.log(`Code: ${setCode}`);
  if (searchTextOverride) console.log(`Search text override: ${searchTextOverride}`);

  // 이미지 폴더 prefix 추출 (기존 sample 카드에서)
  const sampleImg = setData.cards[0]?.image_url ?? "";
  const folderPrefix = sampleImg ? sampleImg.replace(/\/[^/]+$/, "/") : "";
  const filePrefix = getFilePrefix(sampleImg);
  console.log(`CDN folder prefix: ${folderPrefix || "(not set)"}`);
  if (filePrefix) console.log(`CDN file prefix: ${filePrefix}`);

  // Step 1: 카드 목록 수집
  console.log("\n[1/2] Collecting card list from search API…");
  const refs = await fetchAllRefs(searchTextOverride ?? setData.name_ko, folderPrefix, filePrefix);

  if (refs.length === 0) {
    console.error("No cards found. Check set name and network.");
    process.exit(1);
  }

  // Step 2: 상세 페이지 크롤
  console.log(`\n[2/2] Fetching detail pages (${refs.length} cards, ~${Math.ceil(refs.length * delayMs / 1000)}s)…`);
  const cards: CardEntry[] = [];

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const cardNum = ref.CardNum.trim().replace(/\s+/g, "");
    const fallbackImg = ref.feature_image.replace(/\?.*$/, "");
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${refs.length}] ${cardNum} `);

    try {
      const res = await fetch(`${BASE_URL}/cards/detail/${cardNum}`, {
        headers: { Referer: `${BASE_URL}/cards` },
      });
      const html = await res.text();
      const detail = parseCardDetail(html, cardNum, setData.rarities, fallbackImg);

      console.log(
        `→ ${detail.name_ko ?? "?"} | ${detail.rarity ?? "?"} | #${detail.number ?? "?"}`
      );

      cards.push({
        card_num: cardNum,
        ...detail,
        _source: `https://pokemoncard.co.kr/cards/detail/${cardNum}`,
        _fetched_at: today,
      });
    } catch (err) {
      console.log(`→ ERROR: ${err}`);
      cards.push({
        card_num: cardNum,
        number: null,
        name_ko: null,
        rarity: null,
        card_type: null,
        subtype: null,
        hp: null,
        type: null,
        image_url: fallbackImg,
        _source: `https://pokemoncard.co.kr/cards/detail/${cardNum}`,
        _fetched_at: today,
      });
    }

    if (i < refs.length - 1) await sleep(delayMs);
  }

  // 번호 순 정렬
  cards.sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  // 총 카드 수 경고
  const firstCard = cards.find((c) => c.number !== null);
  if (firstCard) {
    // 상세 HTML에서 총수 추출은 했지만 변수가 없으므로 cards 배열 길이로 확인
    console.log(`\nTotal cards fetched: ${cards.length}`);
  }

  const outputCards = merge ? mergeOfficialCards(setData.cards, cards) : cards;

  if (dryRun) {
    console.log("\n[dry-run] First 3 cards:");
    console.log(JSON.stringify(outputCards.slice(0, 3), null, 2));
    return;
  }

  const updated: SetJson = { ...setData, cards: outputCards, _fetched_at: today };
  writeFileSync(dataPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  console.log(`\nSaved → ${dataPath}`);
}

function mergeOfficialCards(existingCards: CardEntry[], officialCards: CardEntry[]): CardEntry[] {
  const existingByCardNum = new Map(existingCards.map((card) => [card.card_num, card]));
  const officialCardNums = new Set(officialCards.map((card) => card.card_num));
  const mergedCards = officialCards.map((officialCard) => {
    const existingCard = existingByCardNum.get(officialCard.card_num);
    const validOfficialFields = Object.fromEntries(
      Object.entries(officialCard).filter(([, value]) => value !== null && value !== ""),
    );
    const mergedCard = { ...existingCard, ...validOfficialFields } as CardEntry;

    if (officialCard.name_ko && officialCard.rarity && officialCard.image_url) {
      delete mergedCard._manual;
      delete mergedCard._image_source_url;
    }

    return mergedCard;
  });

  const preservedCards = existingCards.filter((card) => !officialCardNums.has(card.card_num));
  const outputCards = [...mergedCards, ...preservedCards];
  outputCards.sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
  console.log(
    `Merged official=${officialCards.length}, preserved local-only=${preservedCards.length}, total=${outputCards.length}`,
  );
  return outputCards;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
