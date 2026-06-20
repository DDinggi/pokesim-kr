#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(REPO_ROOT, "data", "sets");
const SETS_INDEX = join(REPO_ROOT, "data", "sets-index.json");
const DEFAULT_CDN_BASE = "https://img.pokesim.kr/";

const DEFAULT_RARITIES = new Set([
  "S",
  "A",
  "25TH",
  "S8AP",
  "K",
  "CHR",
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

interface CardEntry {
  card_num?: string;
  number?: number | null;
  name_ko?: string | null;
  rarity?: string | null;
  image_url?: string | null;
}

interface SetJson {
  code?: string;
  cards?: CardEntry[];
}

interface SetsIndex {
  active_sets?: string[];
}

interface ImageAudit {
  setCode: string;
  card: CardEntry;
  url: string;
  bytesHash: string;
  perceptualHash: bigint;
}

interface Finding {
  level: "warn" | "error";
  setCode: string;
  message: string;
}

const argv = process.argv.slice(2);
const targetSet = readArg("--set");
const includeAllCards = argv.includes("--all-cards");
const strict = argv.includes("--strict");
const jsonOutput = argv.includes("--json");
const concurrency = readPositiveInt("--concurrency", 6);
const nearThreshold = readPositiveInt("--near-threshold", 8);
const cdnBase = (process.env.NEXT_PUBLIC_CARD_IMAGE_CDN_BASE ?? DEFAULT_CDN_BASE).replace(/\/+$/, "");
const rarityFilter = parseRarities(readArg("--rarities"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const setCodes = getTargetSetCodes();
  const findings: Finding[] = [];
  let imageCount = 0;

  for (const setCode of setCodes) {
    const set = readJson<SetJson>(join(DATA_SETS_DIR, `${setCode}.json`));
    const cards = (set.cards ?? []).filter(shouldAuditCard);
    if (cards.length === 0) continue;

    const audits = await mapLimit(cards, concurrency, async (card) => auditCard(setCode, card, findings));
    const okAudits = audits.filter((audit): audit is ImageAudit => audit !== null);
    imageCount += okAudits.length;

    findExactDuplicates(setCode, okAudits, findings);
    findNearDuplicates(setCode, okAudits, findings);

    if (!jsonOutput) {
      const setFindings = findings.filter((finding) => finding.setCode === setCode);
      const warn = setFindings.filter((finding) => finding.level === "warn").length;
      const error = setFindings.filter((finding) => finding.level === "error").length;
      console.log(`${setCode}: checked=${okAudits.length}/${cards.length} warn=${warn} error=${error}`);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ checked_images: imageCount, findings }, null, 2));
  } else {
    for (const finding of findings) {
      console.log(`[${finding.level}] ${finding.setCode}: ${finding.message}`);
    }
    console.log(`\nimage audit: sets=${setCodes.length} checked_images=${imageCount} findings=${findings.length}`);
  }

  if (findings.some((finding) => finding.level === "error") || (strict && findings.length > 0)) {
    process.exitCode = 1;
  }
}

function getTargetSetCodes(): string[] {
  if (targetSet) return [targetSet];
  const index = readJson<SetsIndex>(SETS_INDEX);
  return [...(index.active_sets ?? [])].sort();
}

function shouldAuditCard(card: CardEntry): boolean {
  if (includeAllCards) return true;
  return !!card.rarity && rarityFilter.has(card.rarity);
}

async function auditCard(
  setCode: string,
  card: CardEntry,
  findings: Finding[],
): Promise<ImageAudit | null> {
  const url = imageUrlFor(card);
  if (!url) {
    findings.push({ level: "warn", setCode, message: `${cardLabel(card)} image_url is missing` });
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
    });
    if (!response.ok) {
      findings.push({ level: "warn", setCode, message: `${cardLabel(card)} image HTTP ${response.status} ${url}` });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const bytesHash = createHash("sha256").update(buffer).digest("hex");
    const perceptualHash = await averageHash(buffer);

    return { setCode, card, url, bytesHash, perceptualHash };
  } catch (error) {
    findings.push({ level: "warn", setCode, message: `${cardLabel(card)} image ${(error as Error).message}` });
    return null;
  }
}

function imageUrlFor(card: CardEntry): string | null {
  const imageUrl = card.image_url?.trim();
  if (!imageUrl) return null;
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;

  const key = imageUrl.replace(/^\/+/, "");
  return `${cdnBase}/cards/256/${stripExtension(key)}.webp`;
}

function stripExtension(path: string): string {
  return path.replace(/\.[a-zA-Z0-9]+$/, "");
}

async function averageHash(buffer: Buffer): Promise<bigint> {
  const raw = await sharp(buffer)
    .resize(16, 16, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();
  const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  let hash = 0n;

  for (const value of raw) {
    hash = (hash << 1n) | (value >= mean ? 1n : 0n);
  }

  return hash;
}

function findExactDuplicates(setCode: string, audits: ImageAudit[], findings: Finding[]) {
  const byHash = new Map<string, ImageAudit[]>();
  for (const audit of audits) {
    const bucket = byHash.get(audit.bytesHash) ?? [];
    bucket.push(audit);
    byHash.set(audit.bytesHash, bucket);
  }

  for (const bucket of byHash.values()) {
    if (bucket.length < 2) continue;
    if (isExpectedDuplicateGroup(bucket)) continue;

    findings.push({
      level: "warn",
      setCode,
      message: `exact duplicate image: ${bucket.map((audit) => cardLabel(audit.card)).join(" <-> ")}`,
    });
  }
}

function findNearDuplicates(setCode: string, audits: ImageAudit[], findings: Finding[]) {
  for (let i = 0; i < audits.length; i += 1) {
    for (let j = i + 1; j < audits.length; j += 1) {
      const a = audits[i]!;
      const b = audits[j]!;
      if (a.bytesHash === b.bytesHash) continue;
      if (isExpectedDuplicatePair(a, b)) continue;

      const distance = hammingDistance(a.perceptualHash, b.perceptualHash);
      if (distance > nearThreshold) continue;

      findings.push({
        level: "warn",
        setCode,
        message: `near duplicate image d=${distance}: ${cardLabel(a.card)} <-> ${cardLabel(b.card)}`,
      });
    }
  }
}

function isExpectedDuplicateGroup(audits: ImageAudit[]): boolean {
  return audits.length > 1 && audits.every((audit) => isVUnionCard(audit.card));
}

function isExpectedDuplicatePair(a: ImageAudit, b: ImageAudit): boolean {
  return isVUnionCard(a.card) && isVUnionCard(b.card);
}

function isVUnionCard(card: CardEntry): boolean {
  return (card.name_ko ?? "").toUpperCase().includes("V-UNION");
}

function hammingDistance(a: bigint, b: bigint): number {
  let value = a ^ b;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, limit) }, run));
  return results;
}

function parseRarities(value: string | null): Set<string> {
  if (!value) return DEFAULT_RARITIES;
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function cardLabel(card: CardEntry): string {
  const number = Number.isInteger(card.number) ? `#${card.number}` : card.card_num ?? "unknown";
  return `${number} ${card.name_ko ?? "?"} ${card.rarity ?? "?"}`;
}

function readArg(name: string): string | null {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = readArg(name);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
