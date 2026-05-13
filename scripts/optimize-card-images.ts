#!/usr/bin/env tsx

import { readdirSync, readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SETS_DIR = join(REPO_ROOT, "data", "sets");
const POKEMON_KOREA_IMAGE_BASE = "https://cards.image.pokemonkorea.co.kr/data/";
const DEFAULT_CDN_BASE = "https://img.pokesim.kr/";
const DEFAULT_BUCKET = "pokesim-kr-cards";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

dotenv.config({ path: join(REPO_ROOT, "frontend", ".env.local") });
dotenv.config({ path: join(REPO_ROOT, ".env.local") });

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const force = argv.includes("--force");
const verifyOnly = argv.includes("--verify-only");
const targetSet = readArg("--set");
const sizes = parseSizes(readArg("--sizes") ?? "256,512");
const concurrency = readPositiveInt("--concurrency", 4);
const quality = readPositiveInt("--quality", 76);

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET ?? DEFAULT_BUCKET;
const cdnBase = process.env.NEXT_PUBLIC_CARD_IMAGE_CDN_BASE ?? DEFAULT_CDN_BASE;

if (!verifyOnly && !dryRun && (!accountId || !accessKeyId || !secretAccessKey)) {
  console.error(
    "Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY. Put them in frontend/.env.local or .env.local.",
  );
  process.exit(1);
}

const s3 =
  accountId && accessKeyId && secretAccessKey
    ? new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

interface CardEntry {
  card_num?: string;
  image_url?: string;
}

interface SetJson {
  code?: string;
  cards?: CardEntry[];
}

interface ImageTask {
  setCode: string;
  cardNum?: string;
  originalKey: string;
  sourceUrl: string;
}

interface Stats {
  sourceImages: number;
  uploaded: number;
  skipped: number;
  verified: number;
  missing: number;
  failed: number;
  downloadedBytes: number;
  uploadedBytes: number;
}

main().catch((error) => {
  console.error(formatError(error));
  process.exit(1);
});

async function main() {
  const tasks = collectTasks();
  const stats: Stats = {
    sourceImages: tasks.length,
    uploaded: 0,
    skipped: 0,
    verified: 0,
    missing: 0,
    failed: 0,
    downloadedBytes: 0,
    uploadedBytes: 0,
  };

  await runLimited(
    tasks.map((task) => async () => {
      await processImage(task, stats);
    }),
    concurrency,
  );

  console.log(
    [
      `Done.`,
      `sourceImages=${stats.sourceImages}`,
      `uploaded=${stats.uploaded}`,
      `skipped=${stats.skipped}`,
      `verified=${stats.verified}`,
      `missing=${stats.missing}`,
      `failed=${stats.failed}`,
      `downloaded=${formatBytes(stats.downloadedBytes)}`,
      `uploadedBytes=${formatBytes(stats.uploadedBytes)}`,
    ].join(" "),
  );

  if (stats.failed > 0 || stats.missing > 0) process.exitCode = 1;
}

function collectTasks(): ImageTask[] {
  const files = readdirSync(SETS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !targetSet || file === `${targetSet}.json`)
    .sort();
  const tasks = new Map<string, ImageTask>();

  for (const file of files) {
    const filePath = join(SETS_DIR, file);
    const setData = JSON.parse(readFileSync(filePath, "utf8")) as SetJson;
    const setCode = setData.code ?? file.replace(/\.json$/, "");

    for (const card of setData.cards ?? []) {
      const originalKey = originalKeyFor(setCode, card);
      if (!originalKey) continue;

      tasks.set(originalKey, {
        setCode,
        cardNum: card.card_num,
        originalKey,
        sourceUrl: sourceUrlFor(card, originalKey),
      });
    }
  }

  return Array.from(tasks.values());
}

async function processImage(task: ImageTask, stats: Stats) {
  const variantKeys = sizes.map((size) => variantKeyFor(task.originalKey, size));

  if (verifyOnly) {
    for (const key of variantKeys) {
      try {
        if (await publicObjectExists(key)) stats.verified++;
        else {
          stats.missing++;
          console.error(`[missing] ${task.setCode} ${task.cardNum ?? ""} ${publicUrlFor(key)}`);
        }
      } catch (error) {
        stats.failed++;
        console.error(`[verify-failed] ${task.setCode} ${task.cardNum ?? ""}: ${formatError(error)}`);
      }
    }
    return;
  }

  const missingKeys: string[] = [];
  for (const key of variantKeys) {
    const exists = !force && (dryRun ? await publicObjectExists(key) : await r2ObjectExists(key));
    if (exists) stats.skipped++;
    else missingKeys.push(key);
  }

  if (missingKeys.length === 0) return;

  if (dryRun) {
    for (const key of missingKeys) {
      console.log(`[dry-upload] ${task.sourceUrl} -> ${key}`);
      stats.uploaded++;
    }
    return;
  }

  try {
    const source = await downloadSource(task.sourceUrl);
    stats.downloadedBytes += source.length;

    for (const size of sizes) {
      const key = variantKeyFor(task.originalKey, size);
      if (!missingKeys.includes(key)) continue;

      const optimized = await sharp(source)
        .rotate()
        .resize({ width: size, withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();

      await uploadVariant(key, optimized);
      stats.uploaded++;
      stats.uploadedBytes += optimized.length;
      console.log(`[uploaded] ${key} ${formatBytes(source.length)} -> ${formatBytes(optimized.length)}`);
    }
  } catch (error) {
    stats.failed++;
    console.error(`[failed] ${task.setCode} ${task.cardNum ?? ""}: ${formatError(error)}`);
  }
}

function originalKeyFor(setCode: string, card: CardEntry): string | null {
  const imageUrl = card.image_url;
  if (!imageUrl) return null;

  if (/^https?:\/\//.test(imageUrl)) {
    const id = card.card_num ?? imageUrl.split("/").pop()?.split("?")[0] ?? "card";
    return `external/${setCode}/${id}.${extensionFromUrl(imageUrl)}`;
  }

  return imageUrl.replace(/^\/+/, "");
}

function sourceUrlFor(card: CardEntry, originalKey: string): string {
  if (card.image_url && /^https?:\/\//.test(card.image_url)) {
    return card.image_url;
  }

  if (card.image_url?.startsWith("wmimages/")) {
    return `${POKEMON_KOREA_IMAGE_BASE}${card.image_url}`;
  }

  return publicUrlFor(originalKey);
}

function variantKeyFor(originalKey: string, size: number): string {
  const withoutExtension = originalKey.replace(/\.[a-zA-Z0-9]+$/, "");
  return `cards/${size}/${withoutExtension}.webp`;
}

function extensionFromUrl(url: string): string {
  const clean = url.split("?")[0]?.split("#")[0] ?? "";
  const ext = clean.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (!ext) return "jpg";
  if (ext === "jpeg") return "jpg";
  return ext;
}

async function publicObjectExists(key: string): Promise<boolean> {
  const response = await fetch(publicUrlFor(key), { method: "HEAD" });
  return response.ok;
}

async function r2ObjectExists(key: string): Promise<boolean> {
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function downloadSource(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PokeSim KR image optimizer (+https://pokesim.kr)",
      Referer: "https://pokesim.kr/",
    },
  });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status} ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function uploadVariant(key: string, body: Buffer) {
  if (!s3) throw new Error("R2 client is not configured.");

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function runLimited<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, () => worker()),
  );

  return results;
}

function publicUrlFor(key: string): string {
  return `${cdnBase.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function readArg(name: string): string | null {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function readPositiveInt(name: string, fallback: number): number {
  const rawValue = readArg(name);
  if (!rawValue) return fallback;

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseSizes(value: string): number[] {
  const parsed = value
    .split(/[,\s]+/)
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : [256, 512];
}
