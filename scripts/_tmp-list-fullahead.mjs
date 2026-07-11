import { parse } from "node-html-parser";

const BASE = "https://pokemon-card-fullahead.com";

async function fetchEucJp(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PokeSimKR/1.0; +https://pokesim.kr)",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
    },
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return new TextDecoder("euc-jp").decode(await r.arrayBuffer());
}

function decodeHtml(v) {
  return v.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function escapeRegExp(v) { return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function extractRarity(title) {
  const m = title.toUpperCase().match(/\b(BWR|MUR|GRA|SAR|CSR|CHR|SSR|AR|SR|HR|UR|ACE|TR|K)\b/);
  return m?.[1] ?? null;
}
function candidates(shopCode) {
  const lower = shopCode.toLowerCase();
  const padded = lower.replace(/^([a-z]+)(\d)([a-z]*)$/, "$10$2$3");
  const noLead = lower.replace(/^([a-z]+)0+(\d)/, "$1$2");
  return [...new Set([lower, padded, noLead])];
}
function fullaheadCodePattern(shopCode) {
  const escaped = escapeRegExp(shopCode.toUpperCase());
  return escaped.endsWith("PLUS") ? `${escaped.slice(0, -4)}(?:PLUS|\\+)` : escaped;
}
function parseItems(html, shopCode) {
  const items = [];
  const codeRegex = new RegExp(`PK-${fullaheadCodePattern(shopCode)}-([0-9]{1,3})`, "i");
  const root = parse(html);
  for (const n of root.querySelectorAll("span.itemName")) {
    const title = decodeHtml(n.text.trim());
    const cm = title.match(codeRegex);
    if (!cm) continue;
    const anchor = n.parentNode;
    const block = anchor?.parentNode;
    const priceText = block?.querySelector("span.itemPrice strong")?.text ?? "";
    const number = Number(cm[1]);
    const priceJpy = Number(priceText.replace(/[^\d]/g, ""));
    items.push({ number, title, rarity: extractRarity(title), priceJpy });
  }
  return items;
}

async function firstPage(shopCode) {
  let lastErr;
  for (const cc of candidates(shopCode)) {
    try { return { cc, html: await fetchEucJp(`${BASE}/shopbrand/${cc}/`) }; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchAll(shopCode) {
  const { cc, html } = await firstPage(shopCode);
  const map = new Map();
  for (const it of parseItems(html, shopCode)) map.set(`${it.number}-${it.priceJpy}`, it);
  for (let p = 2; p <= 30; p++) {
    let h;
    try { h = await fetchEucJp(`${BASE}/shopbrand/${cc}/page${p}/recommend/`); } catch { break; }
    const items = parseItems(h, shopCode);
    if (items.length === 0) break;
    for (const it of items) map.set(`${it.number}-${it.priceJpy}`, it);
  }
  return [...map.values()];
}

const shopCode = process.argv[2];
const minNum = Number(process.argv[3] || 0);
const items = await fetchAll(shopCode);
const byNum = new Map();
for (const it of items) {
  const prev = byNum.get(it.number);
  if (!prev || it.priceJpy > prev.priceJpy) byNum.set(it.number, it);
}
const sorted = [...byNum.values()].sort((a, b) => a.number - b.number);
console.log(`shop=${shopCode} total_items=${items.length} unique_numbers=${sorted.length}`);
for (const it of sorted) {
  if (it.number >= minNum) console.log(it.number, it.rarity, it.priceJpy, it.title);
}
