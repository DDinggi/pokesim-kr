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
  [key: string]: unknown;
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
        if (await publicObjectExists(task.key)) stats.verified++;
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

async function uploadObject(key: string, sourceUrl: string): Promise<void> {
  if (!s3) throw new Error("R2 client is not configured.");

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "PokéSim KR asset migration (+https://pokesim.kr)",
      Referer: "https://pokesim.kr/",
    },
  });
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);

  const ext = extensionFromUrl(sourceUrl);
  const body = Buffer.from(await response.arrayBuffer());
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
      const key = objectKeyFor(setCode, card);
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
            await uploadObject(key, sourceUrl);
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
