#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import simulatorDefault from "../frontend/lib/simulator.ts";
import luckDefault from "../frontend/lib/luck.ts";
import type { Card, SetMeta } from "../frontend/lib/types.ts";
import type { WeightedLuckScore } from "../frontend/lib/luck.ts";

type SetIndex = {
  active_sets?: string[];
  planned_sets?: string[];
};

type Args = {
  all: boolean;
  samples: number;
  setCodes: string[];
  mode: "box" | "pack";
  units: number;
  summary: boolean;
};

type AuditResult = {
  scored: number;
  tierCounts: Map<string, number>;
  tierScores: number[];
  ratios: number[];
  values: number[];
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const {
  simulateBox,
  simulatePack,
} = simulatorDefault as unknown as typeof import("../frontend/lib/simulator.ts");
const {
  createLuckOpening,
  summarizeWeightedLuckEvent,
} = luckDefault as unknown as typeof import("../frontend/lib/luck.ts");
const TIER_THRESHOLDS = [
  ["strongest", 1.55],
  ["protagonist", 1.3],
  ["champion", 1],
  ["elite4", 0.85],
  ["gym", 0.65],
  ["elite_trainer", 0.4],
  ["pokemon_maniac", 0.15],
  ["picnic", -0.25],
  ["shorts", -0.8],
  ["grunt", Number.NEGATIVE_INFINITY],
] as const;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    all: false,
    samples: 1000,
    setCodes: [],
    mode: "box",
    units: 1,
    summary: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--samples") args.samples = Math.max(1, Number(argv[++i]) || args.samples);
    else if (arg === "--set") args.setCodes.push(...argv[++i].split(/[,\s]+/).map((value) => value.trim()).filter(Boolean));
    else if (arg === "--mode" && (argv[i + 1] === "box" || argv[i + 1] === "pack")) args.mode = argv[++i];
    else if (arg === "--units") args.units = Math.max(1, Number(argv[++i]) || args.units);
    else if (arg === "--summary") args.summary = true;
  }

  return args;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadSet(setCode: string): SetMeta {
  return readJson<SetMeta>(resolve(ROOT_DIR, "data", "sets", `${setCode}.json`));
}

function getTargetSetCodes(args: Args): string[] {
  if (args.setCodes.length > 0) return args.setCodes;

  const index = readJson<SetIndex>(resolve(ROOT_DIR, "data", "sets-index.json"));
  if (args.all) return [...(index.active_sets ?? []), ...(index.planned_sets ?? [])];
  return index.active_sets ?? [];
}

function tierName(score: WeightedLuckScore): string {
  return TIER_THRESHOLDS.find(([, minScore]) => score.luckTierScore >= minScore)?.[0] ?? "grunt";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function sampleOpening(set: SetMeta, mode: Args["mode"], units: number, seed: string): Card[] {
  if (mode === "pack" || set.type === "starter") {
    return Array.from({ length: units }, (_, index) =>
      simulatePack(set.cards, set.type, set.pack_size, `${seed}:pack:${index}`, set.code).pack.cards,
    ).flat();
  }

  return Array.from({ length: units }, (_, index) =>
    simulateBox(set.cards, set.box_size, set.type, set.pack_size, `${seed}:box:${index}`, set.code)
      .packs
      .flatMap((pack) => pack.cards),
  ).flat();
}

function scoreOpening(set: SetMeta, mode: Args["mode"], units: number, cards: Card[]): WeightedLuckScore | null {
  return summarizeWeightedLuckEvent(
    cards,
    createLuckOpening(set, mode === "pack" || set.type === "starter" ? { packs: units } : { boxes: units }),
    set,
  );
}

function auditSet(setCode: string, samples: number, mode: Args["mode"], units: number, quiet = false): AuditResult {
  const set = loadSet(setCode);
  const tierCounts = new Map<string, number>();
  const tierScores: number[] = [];
  const ratios: number[] = [];
  const values: number[] = [];
  let scored = 0;

  for (let i = 0; i < samples; i++) {
    const cards = sampleOpening(set, mode, units, `value-audit:${set.code}:${mode}:u${units}:${i}`);
    const score = scoreOpening(set, mode, units, cards);
    if (!score) continue;

    scored++;
    tierCounts.set(tierName(score), (tierCounts.get(tierName(score)) ?? 0) + 1);
    tierScores.push(score.luckTierScore);
    if (typeof score.valueRatio === "number" && Number.isFinite(score.valueRatio)) ratios.push(score.valueRatio);
    if (typeof score.observedValueKrw === "number") values.push(score.observedValueKrw);
  }

  tierScores.sort((a, b) => a - b);
  ratios.sort((a, b) => a - b);
  values.sort((a, b) => a - b);

  const compactTiers = TIER_THRESHOLDS
    .map(([name]) => `${name}:${formatPercent(tierCounts.get(name) ?? 0, scored)}`)
    .join(" ");

  if (!quiet) {
    console.log(
      [
        set.code.padEnd(24),
        `n=${String(scored).padStart(4)}`,
        `units=${units}`,
        `value p50=${Math.round(percentile(values, 0.5)).toLocaleString()} p90=${Math.round(percentile(values, 0.9)).toLocaleString()}`,
        `ratio p50=${percentile(ratios, 0.5).toFixed(2)} p90=${percentile(ratios, 0.9).toFixed(2)}`,
        `score p10=${percentile(tierScores, 0.1).toFixed(2)} p50=${percentile(tierScores, 0.5).toFixed(2)} p90=${percentile(tierScores, 0.9).toFixed(2)}`,
        compactTiers,
      ].join(" | "),
    );
  }

  return { scored, tierCounts, tierScores, ratios, values };
}

function mergeAuditResult(total: AuditResult, result: AuditResult): AuditResult {
  for (const [tier, count] of result.tierCounts) {
    total.tierCounts.set(tier, (total.tierCounts.get(tier) ?? 0) + count);
  }
  total.scored += result.scored;
  total.tierScores.push(...result.tierScores);
  total.ratios.push(...result.ratios);
  total.values.push(...result.values);
  return total;
}

function printSummary(result: AuditResult, setCount: number, mode: Args["mode"], units: number): void {
  result.tierScores.sort((a, b) => a - b);
  result.ratios.sort((a, b) => a - b);
  result.values.sort((a, b) => a - b);

  console.log(`\nsummary mode=${mode} units=${units} sets=${setCount} n=${result.scored}`);
  console.log(
    `value p50=${Math.round(percentile(result.values, 0.5)).toLocaleString()} `
    + `p90=${Math.round(percentile(result.values, 0.9)).toLocaleString()} | `
    + `ratio p50=${percentile(result.ratios, 0.5).toFixed(2)} `
    + `p90=${percentile(result.ratios, 0.9).toFixed(2)} | `
    + `score p10=${percentile(result.tierScores, 0.1).toFixed(2)} `
    + `p50=${percentile(result.tierScores, 0.5).toFixed(2)} `
    + `p90=${percentile(result.tierScores, 0.9).toFixed(2)}`,
  );
  for (const [tier] of TIER_THRESHOLDS) {
    console.log(`${tier.padEnd(10)} ${formatPercent(result.tierCounts.get(tier) ?? 0, result.scored)}`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const setCodes = getTargetSetCodes(args);
  const total: AuditResult = {
    scored: 0,
    tierCounts: new Map(),
    tierScores: [],
    ratios: [],
    values: [],
  };
  for (const setCode of setCodes) {
    mergeAuditResult(total, auditSet(setCode, args.samples, args.mode, args.units, args.summary));
  }
  if (args.summary || setCodes.length > 1) printSummary(total, setCodes.length, args.mode, args.units);
}

main();
