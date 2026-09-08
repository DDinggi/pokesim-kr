#!/usr/bin/env tsx
/**
 * Detect cards that a configured SM simulator can never return. This is a
 * stochastic reachability audit, so it uses enough deterministic boxes to
 * cover the rarest configured slots; it is not an assertion about real pulls.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const getArg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const setCode = getArg('--set');
const trials = Number(getArg('--trials') ?? 2000);
if (args.some((arg) => !['--set', '--trials'].includes(arg) && ![setCode, String(trials)].includes(arg)) || !Number.isInteger(trials) || trials < 1) {
  throw new Error('Usage: audit:sm-reachability [-- --set <code>] [--trials 2000]');
}
const sets = readdirSync(resolve(root, 'data/sets')).filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(resolve(root, 'data/sets', file), 'utf8')) as SetMeta)
  .filter((set) => set.series === 'SM' && (!setCode || set.code === setCode));
if (!sets.length) throw new Error('No matching SM set');

let failures = 0;
for (const set of sets) {
  const expected = new Set(set.cards.map((card) => card.card_num));
  const seen = new Set<string>();
  let malformed = 0;
  for (let i = 0; i < trials; i++) {
    const result = simulateBox(set.cards, set.box_size, set.type, set.pack_size, `sm-reachability-${i}`, set.code);
    for (const pack of result.packs) {
      if (pack.cards.length !== set.pack_size) malformed++;
      for (const card of pack.cards) seen.add(card.card_num);
    }
  }
  const missing = [...expected].filter((cardNum) => !seen.has(cardNum));
  if (missing.length || malformed) {
    failures++;
    console.error(`${set.code}: ${missing.length} unreachable, ${malformed} malformed packs${missing.length ? ` (${missing.join(', ')})` : ''}`);
  } else {
    console.log(`${set.code}: all ${expected.size} cards reached; ${trials * set.box_size} boxes-packs shape checked`);
  }
}
if (failures) throw new Error(`${failures} SM set(s) have unreachable cards or malformed packs`);
console.log(`Reachability passed for ${sets.length} SM set(s) at ${trials} boxes each.`);
