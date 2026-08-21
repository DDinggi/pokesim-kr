#!/usr/bin/env tsx

/**
 * Apply reviewed card-name/type corrections after a Japanese fallback import.
 *
 * The collector intentionally keeps the Japanese source name in `name_ko` until
 * a reviewed mapping is supplied. This command patches the set JSON without
 * replacing image/provenance fields, and can keep the generated manual TSV in
 * sync so a later manual-add step does not reintroduce the untranslated names.
 *
 * Usage:
 *   pnpm --dir scripts update:card-metadata -- \
 *     --set m6-storm-emerald \
 *     --tsv data/manual/m6-storm-emerald-metadata.tsv \
 *     --manual-tsv data/manual/m6-storm-emerald-additions.tsv
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

interface Mapping {
  number: number;
  name_ko?: string;
  card_type?: string;
}

interface Card {
  number?: number;
  name_ko?: string | null;
  card_type?: string | null;
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function resolveInputPath(value: string): string {
  const fromCwd = resolve(process.cwd(), value);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRepoRoot = resolve(REPO_ROOT, value);
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return fromCwd;
}

function parseTsv(text: string): { headers: string[]; rows: string[][]; lines: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('#'));
  if (headerIndex === -1) throw new Error('TSV header was not found.');

  const headers = lines[headerIndex]!.split('\t').map((value) => value.trim());
  const rows = lines
    .slice(headerIndex + 1)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .map((line) => line.split('\t'));
  return { headers, rows, lines };
}

function readMappings(path: string): Map<number, Mapping> {
  const { headers, rows } = parseTsv(readFileSync(path, 'utf8'));
  const numberIndex = headers.indexOf('number');
  const nameIndex = headers.indexOf('name_ko');
  const typeIndex = headers.indexOf('card_type');
  if (numberIndex === -1 || (nameIndex === -1 && typeIndex === -1)) {
    throw new Error('Mapping TSV requires number and at least one of name_ko/card_type.');
  }

  const mappings = new Map<number, Mapping>();
  for (const row of rows) {
    const number = Number(row[numberIndex]);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`Invalid card number in mapping TSV: ${row[numberIndex] ?? ''}`);
    }
    if (mappings.has(number)) throw new Error(`Duplicate mapping for card #${number}.`);
    const name_ko = nameIndex === -1 ? undefined : row[nameIndex]?.trim() || undefined;
    const card_type = typeIndex === -1 ? undefined : row[typeIndex]?.trim() || undefined;
    mappings.set(number, { number, name_ko, card_type });
  }
  return mappings;
}

function applyToSet(path: string, mappings: Map<number, Mapping>) {
  const set = JSON.parse(readFileSync(path, 'utf8')) as { cards?: Card[] };
  const cards = set.cards ?? [];
  const cardsByNumber = new Map(cards.map((card) => [card.number, card]));
  const missing = [...mappings.keys()].filter((number) => !cardsByNumber.has(number));
  if (missing.length > 0) {
    throw new Error(`Set is missing mapped cards: ${missing.join(', ')}`);
  }

  let updated = 0;
  for (const mapping of mappings.values()) {
    const card = cardsByNumber.get(mapping.number)!;
    const nextName = mapping.name_ko ?? card.name_ko;
    const nextType = mapping.card_type ?? card.card_type;
    if (card.name_ko !== nextName || card.card_type !== nextType) updated++;
    card.name_ko = nextName;
    card.card_type = nextType;
  }
  writeFileSync(path, `${JSON.stringify(set, null, 2)}\n`, 'utf8');
  return updated;
}

function applyToManualTsv(path: string, mappings: Map<number, Mapping>) {
  const source = readFileSync(path, 'utf8');
  const { headers, lines } = parseTsv(source);
  const headerIndex = lines.findIndex((line) => line.trim() && !line.trim().startsWith('#'));
  const numberIndex = headers.indexOf('number');
  const nameIndex = headers.indexOf('name_ko');
  const typeIndex = headers.indexOf('card_type');
  if (numberIndex === -1 || nameIndex === -1 || typeIndex === -1) {
    throw new Error('Manual TSV requires number, name_ko, and card_type columns.');
  }

  let updated = 0;
  const nextLines = lines.map((line, index) => {
    if (index <= headerIndex || !line.trim() || line.trim().startsWith('#')) return line;
    const row = line.split('\t');
    const mapping = mappings.get(Number(row[numberIndex]));
    if (!mapping) return line;
    let changed = false;
    if (mapping.name_ko && row[nameIndex] !== mapping.name_ko) {
      row[nameIndex] = mapping.name_ko;
      changed = true;
    }
    if (mapping.card_type && row[typeIndex] !== mapping.card_type) {
      row[typeIndex] = mapping.card_type;
      changed = true;
    }
    if (changed) updated++;
    return row.join('\t');
  });

  writeFileSync(path, `${nextLines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  return updated;
}

const setCode = readArg('set');
const tsvArg = readArg('tsv');
const manualTsvArg = readArg('manual-tsv');
if (!setCode || !tsvArg) {
  throw new Error('Usage: update:card-metadata --set <code> --tsv <mapping.tsv> [--manual-tsv <additions.tsv>]');
}

const mappings = readMappings(resolveInputPath(tsvArg));
const setPath = join(REPO_ROOT, 'data', 'sets', `${setCode}.json`);
const setUpdated = applyToSet(setPath, mappings);
const manualUpdated = manualTsvArg
  ? applyToManualTsv(resolveInputPath(manualTsvArg), mappings)
  : 0;

console.log(`Updated ${setUpdated} set cards and ${manualUpdated} manual TSV rows from ${mappings.size} reviewed mappings.`);
