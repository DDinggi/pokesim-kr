#!/usr/bin/env tsx

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
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
const targetCard = readArg("--card");
const targetKey = readArg("--key");
const verifyConcurrency = Number(readArg("--concurrency") ?? "16");

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
  _image_source_url?: string;
  _image_composite_source?: string;
  _image_crop_position?: CropPosition;
  _image_crop?: CropBox;
  [key: string]: unknown;
}

type CropPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SetJson {
  code?: string;
  cards?: CardEntry[];
  [key: string]: unknown;
}

interface Stats {
  uploaded: number;
  skipped: number;
  verified: number;
  missing: number;
  rewritten: number;
  failed: number;
}

interface VerifyTask {
  setCode: string;
  card: CardEntry;
  key: string;
}

function readArg(name: string): string | null {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function publicUrlFor(key: string): string {
  return `${trimSlashes(cdnBase)}/${key.replace(/^\/+/, "")}`;
}

function extensionFromUrl(url: string): string {
  const clean = url.split("?")[0]?.split("#")[0] ?? "";
  const ext = clean.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (!ext) return "jpg";
  if (ext === "jpeg") return "jpg";
  return ext;
}

function contentTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function objectKeyFor(setCode: string, card: CardEntry): string | null {
  const imageUrl = card.image_url;
  if (!imageUrl) return null;

  if (/^https?:\/\//.test(imageUrl)) {
    const id = card.card_num ?? imageUrl.split("/").pop()?.split("?")[0] ?? "card";
    return `external/${setCode}/${id}.${extensionFromUrl(imageUrl)}`;
  }

  return imageUrl.replace(/^\/+/, "");
}

function sourceUrlFor(card: CardEntry): string | null {
  if (card._image_composite_source && /^https?:\/\//.test(card._image_composite_source)) {
    return card._image_composite_source;
  }

  if (card._image_source_url && /^https?:\/\//.test(card._image_source_url)) {
    return card._image_source_url;
  }

  const imageUrl = card.image_url;
  if (!imageUrl) return null;
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("wmimages/")) return `${POKEMON_KOREA_IMAGE_BASE}${imageUrl}`;
  return null;
}

async function publicObjectExists(key: string): Promise<boolean> {
  const response = await fetch(publicUrlFor(key), { method: "HEAD" });
  return response.ok;
}

async function verifyObjects(tasks: VerifyTask[], stats: Stats): Promise<void> {
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      if (!task) return;

      try {
        const exists = s3
          ? await r2ObjectExists(task.key)
          : await publicObjectExists(task.key);
        if (exists) stats.verified++;
        else {
          stats.missing++;
          console.error(
            `[missing] ${task.setCode} ${task.card.card_num ?? ""} ${publicUrlFor(task.key)}`,
          );
        }
      } catch (error) {
        stats.failed++;
        console.error(
          `[verify-failed] ${task.setCode} ${task.card.card_num ?? ""}: ${formatError(error)}`,
        );
      }
    }
  }

  const workerCount = Math.max(1, Math.min(verifyConcurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
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

async function uploadObject(key: string, sourceUrl: string, card: CardEntry): Promise<void> {
  if (!s3) throw new Error("R2 client is not configured.");

  const response = await fetch(sourceUrl, {
    headers: downloadHeadersFor(sourceUrl),
  });
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);

  const ext = extensionFromUrl(sourceUrl);
  const source = Buffer.from(await response.arrayBuffer());
  const body = await cropSource(source, card._image_crop, card._image_crop_position);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: response.headers.get("content-type") ?? contentTypeFor(ext),
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function cropSource(
  source: Buffer,
  crop?: CropBox,
  cropPosition?: CropPosition,
): Promise<Buffer> {
  if (crop) {
    return sharp(source).extract(crop).toBuffer();
  }
  if (!cropPosition) return source;

  const metadata = await sharp(source).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 2 || height < 2) throw new Error("composite image dimensions are invalid");

  const leftWidth = Math.floor(width / 2);
  const topHeight = Math.floor(height / 2);
  const isRight = cropPosition.endsWith("right");
  const isBottom = cropPosition.startsWith("bottom");
  return sharp(source)
    .extract({
      left: isRight ? leftWidth : 0,
      top: isBottom ? topHeight : 0,
      width: isRight ? width - leftWidth : leftWidth,
      height: isBottom ? height - topHeight : topHeight,
    })
    .toBuffer();
}

function downloadHeadersFor(url: string): Record<string, string> {
  const origin = originFor(url);
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 PokeSimKRImageBot/1.0",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    Referer: origin ? `${origin}/` : "https://pokesim.kr/",
  };
}

function originFor(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const files = readdirSync(SETS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !targetSet || file === `${targetSet}.json`);

  const stats: Stats = {
    uploaded: 0,
    skipped: 0,
    verified: 0,
    missing: 0,
    rewritten: 0,
    failed: 0,
  };
  const verifyTasks: VerifyTask[] = [];

  for (const file of files) {
    const path = join(SETS_DIR, file);
    let setData: SetJson;
    try {
      setData = JSON.parse(readFileSync(path, "utf8")) as SetJson;
    } catch (error) {
      stats.failed++;
      console.error(`[bad-json] ${file}: ${formatError(error)}`);
      continue;
    }

    const setCode = setData.code ?? file.replace(/\.json$/, "");
    const cards = setData.cards ?? [];
    let changed = false;

    for (const card of cards) {
      if (targetCard && card.card_num !== targetCard && String(card.number ?? "") !== targetCard) {
        continue;
      }

      const key = targetKey ?? objectKeyFor(setCode, card);
      if (!key) {
        stats.skipped++;
        continue;
      }

      if (verifyOnly) {
        verifyTasks.push({ setCode, card, key });
        continue;
      }

      const exists = !force && (dryRun ? await publicObjectExists(key) : await r2ObjectExists(key));
      if (exists) {
        stats.skipped++;
      } else {
        const sourceUrl = sourceUrlFor(card);
        if (!sourceUrl) {
          stats.missing++;
          console.error(`[no-source] ${setCode} ${card.card_num ?? ""} ${key}`);
          continue;
        }

        if (dryRun) {
          console.log(`[dry-upload] ${sourceUrl} -> ${key}`);
        } else {
          try {
            await uploadObject(key, sourceUrl, card);
            console.log(`[uploaded] ${key}`);
          } catch (error) {
            stats.failed++;
            console.error(`[failed] ${setCode} ${card.card_num ?? ""}: ${formatError(error)}`);
            continue;
          }
        }
        stats.uploaded++;
      }

      if (card.image_url && /^https?:\/\//.test(card.image_url)) {
        card._image_source_url ??= card.image_url;
        card.image_url = key;
        changed = true;
        stats.rewritten++;
      }
    }

    if (changed && !dryRun && !verifyOnly) {
      writeFileSync(path, `${JSON.stringify(setData, null, 2)}\n`, "utf8");
    }
  }

  if (verifyOnly) await verifyObjects(verifyTasks, stats);

  console.log(
    `Done. uploaded=${stats.uploaded} skipped=${stats.skipped} verified=${stats.verified} missing=${stats.missing} rewritten=${stats.rewritten} failed=${stats.failed}`,
  );

  if (stats.failed > 0 || stats.missing > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(formatError(error));
  process.exit(1);
});
