#!/usr/bin/env tsx

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type CardEntry = {
  price_ref_krw?: number | null;
  price_ref_jpy?: number | null;
  price_ref_usd?: number | null;
  price_source?: string | null;
  price_updated_at?: string | null;
  price_confidence?: "source" | "manual" | "proxy" | null;
};

type SetJson = {
  cards?: CardEntry[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DATA_SETS_DIR = join(REPO_ROOT, "data", "sets");
const PUBLIC_SETS_DIR = join(REPO_ROOT, "frontend", "public", "sets");
const DRY_RUN = process.argv.includes("--dry-run");

let removedCards = 0;
let changedSets = 0;

for (const file of readdirSync(DATA_SETS_DIR).filter((name) => name.endsWith(".json")).sort()) {
  const dataPath = join(DATA_SETS_DIR, file);
  const publicPath = join(PUBLIC_SETS_DIR, file);
  const set = JSON.parse(readFileSync(dataPath, "utf8")) as SetJson;
  let changed = false;

  for (const card of set.cards ?? []) {
    if (card.price_confidence !== "proxy") continue;

    delete card.price_ref_krw;
    delete card.price_ref_jpy;
    delete card.price_ref_usd;
    delete card.price_source;
    delete card.price_updated_at;
    delete card.price_confidence;
    removedCards++;
    changed = true;
  }

  if (!changed) continue;
  changedSets++;
  if (DRY_RUN) {
    console.log(`[dry] ${file}: proxy prices would be removed`);
    continue;
  }

  const content = `${JSON.stringify(set, null, 2)}\n`;
  writeFileSync(dataPath, content, "utf8");
  writeFileSync(publicPath, content, "utf8");
  console.log(`[proxy-price-removed] ${file}`);
}

console.log(
  `\nDone: removed ${removedCards} proxy price blocks from ${changedSets} set files`
  + (DRY_RUN ? " (dry-run)" : ""),
);
