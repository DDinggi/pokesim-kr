#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SETS_DIR = join(REPO_ROOT, "data", "sets");

const DEFAULT_SET = "m4-ninja-spinner";
const DEFAULT_OLD_BASE = "https://cards.image.pokemonkorea.co.kr/data/";
const DEFAULT_NEW_BASE = "https://img.pokesim.kr/";
const DEFAULT_SAMPLES = 12;
const DEFAULT_RUNS = 3;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_TIMEOUT_MS = 15000;

interface CardEntry {
  card_num?: string;
  number?: number;
  image_url?: string;
}

interface SetJson {
  code?: string;
  cards?: CardEntry[];
}

interface FetchMeasurement {
  label: string;
  key: string;
  url: string;
  ok: boolean;
  status?: number;
  ms: number;
  bytes: number;
  error?: string;
}

interface Summary {
  label: string;
  count: number;
  failed: number;
  avgMs: number | null;
  minMs: number | null;
  medianMs: number | null;
  p75Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  totalBytes: number;
}

interface SiteCheck {
  url: string;
  jsAssetsChecked: number;
  containsOldBase: boolean;
  containsNewBase: boolean;
  containsExpectedBase?: boolean;
  error?: string;
}

interface BenchmarkResult {
  set: string;
  samples: number;
  runs: number;
  concurrency: number;
  warmup: boolean;
  oldBase: string;
  newBase: string;
  old: Summary;
  new: Summary;
  medianImprovementPct: number | null;
  siteChecks: Record<string, SiteCheck>;
}

const argv = process.argv.slice(2);
const targetSet = readArg("--set") ?? DEFAULT_SET;
const sampleCount = readPositiveInt("--samples", DEFAULT_SAMPLES);
const runs = readPositiveInt("--runs", DEFAULT_RUNS);
const concurrency = readPositiveInt("--concurrency", DEFAULT_CONCURRENCY);
const timeoutMs = readPositiveInt("--timeout-ms", DEFAULT_TIMEOUT_MS);
const oldBase = normalizeBase(readArg("--old-base") ?? DEFAULT_OLD_BASE);
const newBase = normalizeBase(readArg("--new-base") ?? DEFAULT_NEW_BASE);
const newVariantSize = readOptionalPositiveInt("--new-size");
const prodSite = readArg("--prod-site");
const stagingSite = readArg("--staging-site");
const expectedProdCdn = readArg("--expected-prod-cdn");
const expectedStagingCdn = readArg("--expected-staging-cdn");
const jsonOutput = argv.includes("--json");
const warmup = !argv.includes("--skip-warmup");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const imageKeys = loadImageKeys(targetSet);
  const sampleKeys = pickEvenly(imageKeys, Math.min(sampleCount, imageKeys.length));

  if (sampleKeys.length === 0) {
    throw new Error(`No comparable wmimages found in data/sets/${targetSet}.json`);
  }

  if (warmup) {
    await runMeasurements("old", oldBase, sampleKeys, 1, concurrency, timeoutMs);
    await runMeasurements("new", newBase, sampleKeys, 1, concurrency, timeoutMs, newVariantSize);
  }

  const oldMeasurements: FetchMeasurement[] = [];
  const newMeasurements: FetchMeasurement[] = [];

  for (let run = 0; run < runs; run += 1) {
    const oldRun = () =>
      runMeasurements("old", oldBase, sampleKeys, 1, concurrency, timeoutMs);
    const newRun = () =>
      runMeasurements("new", newBase, sampleKeys, 1, concurrency, timeoutMs, newVariantSize);

    if (run % 2 === 0) {
      oldMeasurements.push(...(await oldRun()));
      newMeasurements.push(...(await newRun()));
    } else {
      newMeasurements.push(...(await newRun()));
      oldMeasurements.push(...(await oldRun()));
    }
  }

  const oldSummary = summarize("old", oldMeasurements);
  const newSummary = summarize("new", newMeasurements);
  const result: BenchmarkResult = {
    set: targetSet,
    samples: sampleKeys.length,
    runs,
    concurrency,
    warmup,
    oldBase,
    newBase: newVariantSize ? `${newBase}cards/${newVariantSize}/...webp` : newBase,
    old: oldSummary,
    new: newSummary,
    medianImprovementPct: improvementPct(oldSummary.medianMs, newSummary.medianMs),
    siteChecks: {},
  };

  if (prodSite) {
    result.siteChecks.production = await checkSiteBundle(
      prodSite,
      oldBase,
      newBase,
      expectedProdCdn,
    );
  }

  if (stagingSite) {
    result.siteChecks.staging = await checkSiteBundle(
      stagingSite,
      oldBase,
      newBase,
      expectedStagingCdn,
    );
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printResult(result);
}

function loadImageKeys(setCode: string): string[] {
  const filePath = join(SETS_DIR, `${setCode}.json`);
  const setJson = JSON.parse(readFileSync(filePath, "utf8")) as SetJson;
  const seen = new Set<string>();

  for (const card of setJson.cards ?? []) {
    const key = card.image_url?.trim();
    if (!key?.startsWith("wmimages/")) {
      continue;
    }
    seen.add(key);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function pickEvenly<T>(items: T[], count: number): T[] {
  if (count >= items.length) {
    return items;
  }

  const selected: T[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i += 1) {
    const index = Math.floor((i * items.length) / count);
    if (!used.has(index)) {
      selected.push(items[index]);
      used.add(index);
    }
  }

  return selected;
}

async function runMeasurements(
  label: string,
  baseUrl: string,
  keys: string[],
  repeat: number,
  limit: number,
  timeout: number,
  variantSize?: number,
): Promise<FetchMeasurement[]> {
  const tasks: Array<() => Promise<FetchMeasurement>> = [];

  for (let run = 0; run < repeat; run += 1) {
    for (const key of keys) {
      const measuredKey = variantSize ? variantKeyFor(key, variantSize) : key;
      tasks.push(() => measureFetch(label, joinUrl(baseUrl, measuredKey), measuredKey, timeout));
    }
  }

  return runLimited(tasks, limit);
}

async function measureFetch(
  label: string,
  url: string,
  key: string,
  timeout: number,
): Promise<FetchMeasurement> {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
    });
    const body = await response.arrayBuffer();
    const ms = performance.now() - start;

    return {
      label,
      key,
      url,
      ok: response.ok,
      status: response.status,
      ms,
      bytes: body.byteLength,
    };
  } catch (error) {
    return {
      label,
      key,
      url,
      ok: false,
      ms: performance.now() - start,
      bytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
    Array.from({ length: Math.min(limit, tasks.length) }, () => worker()),
  );

  return results;
}

function summarize(label: string, measurements: FetchMeasurement[]): Summary {
  const successful = measurements.filter((item) => item.ok);
  const values = successful.map((item) => item.ms).sort((a, b) => a - b);
  const totalBytes = successful.reduce((sum, item) => sum + item.bytes, 0);

  return {
    label,
    count: measurements.length,
    failed: measurements.length - successful.length,
    avgMs: values.length ? average(values) : null,
    minMs: values.length ? values[0] : null,
    medianMs: percentile(values, 0.5),
    p75Ms: percentile(values, 0.75),
    p95Ms: percentile(values, 0.95),
    maxMs: values.length ? values[values.length - 1] : null,
    totalBytes,
  };
}

async function checkSiteBundle(
  siteUrl: string,
  oldNeedle: string,
  newNeedle: string,
  expectedNeedle?: string,
): Promise<SiteCheck> {
  const normalizedSiteUrl = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;

  try {
    const response = await fetch(normalizedSiteUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await response.text();
    const jsAssets = extractJsAssets(html, normalizedSiteUrl);
    const jsTexts = await runLimited(
      jsAssets.slice(0, 40).map((assetUrl) => async () => {
        const assetResponse = await fetch(assetUrl, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        return assetResponse.ok ? assetResponse.text() : "";
      }),
      concurrency,
    );
    const bundleText = [html, ...jsTexts].join("\n");

    return {
      url: normalizedSiteUrl,
      jsAssetsChecked: jsTexts.length,
      containsOldBase: bundleText.includes(oldNeedle),
      containsNewBase: bundleText.includes(newNeedle),
      containsExpectedBase: expectedNeedle
        ? bundleText.includes(expectedNeedle)
        : undefined,
    };
  } catch (error) {
    return {
      url: normalizedSiteUrl,
      jsAssetsChecked: 0,
      containsOldBase: false,
      containsNewBase: false,
      containsExpectedBase: expectedNeedle ? false : undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function extractJsAssets(html: string, baseUrl: string): string[] {
  const matches = html.matchAll(
    /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+\.js[^"']*)["']/g,
  );
  const assets = new Set<string>();

  for (const match of matches) {
    assets.add(new URL(match[1], baseUrl).toString());
  }

  return Array.from(assets);
}

function printResult(result: BenchmarkResult) {
  console.log("Image delivery benchmark");
  console.log(`set: ${result.set}`);
  console.log(
    `samples: ${result.samples}, runs: ${result.runs}, concurrency: ${result.concurrency}, warmup: ${result.warmup ? "yes" : "no"}`,
  );
  console.log(`old: ${result.oldBase}`);
  console.log(`new: ${result.newBase}`);
  console.log("");

  printSummary(result.old);
  printSummary(result.new);

  if (result.medianImprovementPct === null) {
    console.log("median delta: n/a");
  } else {
    const direction = result.medianImprovementPct >= 0 ? "faster" : "slower";
    console.log(
      `median delta: ${Math.abs(result.medianImprovementPct).toFixed(1)}% ${direction} with new CDN`,
    );
  }

  for (const [name, check] of Object.entries(result.siteChecks)) {
    console.log("");
    console.log(`${name} bundle check: ${check.url}`);

    if (check.error) {
      console.log(`  error: ${check.error}`);
      continue;
    }

    console.log(`  JS assets checked: ${check.jsAssetsChecked}`);
    console.log(`  contains old base: ${check.containsOldBase ? "yes" : "no"}`);
    console.log(`  contains new base: ${check.containsNewBase ? "yes" : "no"}`);

    if (check.containsExpectedBase !== undefined) {
      console.log(
        `  contains expected base: ${check.containsExpectedBase ? "yes" : "no"}`,
      );
    }
  }
}

function printSummary(summary: Summary) {
  console.log(
    `${summary.label}: median ${formatMs(summary.medianMs)}, p75 ${formatMs(summary.p75Ms)}, p95 ${formatMs(summary.p95Ms)}, avg ${formatMs(summary.avgMs)}, min ${formatMs(summary.minMs)}, max ${formatMs(summary.maxMs)}, failed ${summary.failed}/${summary.count}, bytes ${formatBytes(summary.totalBytes)}`,
  );
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const index = Math.ceil(values.length * p) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function improvementPct(oldValue: number | null, newValue: number | null) {
  if (!oldValue || !newValue) {
    return null;
  }

  return ((oldValue - newValue) / oldValue) * 100;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${normalizeBase(baseUrl)}${path.replace(/^\/+/, "")}`;
}

function variantKeyFor(key: string, size: number): string {
  const cleanKey = key.replace(/^\/+/, "").replace(/\.[a-zA-Z0-9]+$/, "");
  return `cards/${size}/${cleanKey}.webp`;
}

function normalizeBase(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function formatMs(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(0)}ms`;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value}B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)}KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function readArg(name: string): string | undefined {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function readPositiveInt(name: string, fallback: number): number {
  const rawValue = readArg(name);

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readOptionalPositiveInt(name: string): number | undefined {
  const rawValue = readArg(name);

  if (!rawValue) {
    return undefined;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
