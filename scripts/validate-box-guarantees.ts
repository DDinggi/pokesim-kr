import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = argv.indexOf('--' + name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const setCode = getArg('set');
const trials = Number(getArg('trials') ?? 1000);

if (!setCode) {
  throw new Error('Usage: validate:box-guarantees -- --set <code> [--trials 1000]');
}
if (!Number.isInteger(trials) || trials < 1) {
  throw new Error('--trials must be a positive integer');
}

type GuaranteeRule = {
  rarity: string;
  min: number;
  max: number;
};

type SetWithGuarantees = SetMeta & {
  box_guarantees?: {
    rules?: GuaranteeRule[];
  };
};

function parseRarities(spec: string): string[] | null {
  const rarities = spec.split('/').map((rarity) => rarity.trim());
  const supported = rarities.length > 0 && rarities.every(
    (rarity) => rarity.length > 0
      && rarity === rarity.toUpperCase()
      && !rarity.includes(' '),
  );
  return supported ? rarities : null;
}

const setPath = resolve(ROOT_DIR, 'data', 'sets', setCode + '.json');
const set = JSON.parse(readFileSync(setPath, 'utf8')) as SetWithGuarantees;
const rules = (set.box_guarantees?.rules ?? [])
  .map((rule) => ({ rule, rarities: parseRarities(rule.rarity) }))
  .filter((entry) => entry.rarities !== null) as {
    rule: GuaranteeRule;
    rarities: string[];
  }[];

const ranges = new Map<string, { min: number; max: number }>();
const errors: string[] = [];

for (let index = 0; index < trials; index++) {
  const result = simulateBox(
    set.cards,
    set.box_size ?? 0,
    set.type,
    set.pack_size ?? 0,
    'guarantee-' + index,
    set.code,
  );

  if (result.packs.length !== set.box_size) {
    errors.push('box ' + index + ': expected ' + set.box_size + ' packs, got ' + result.packs.length);
  }

  const malformedPack = result.packs.findIndex((pack) => pack.cards.length !== set.pack_size);
  if (malformedPack >= 0) {
    errors.push(
      'box ' + index + ', pack ' + malformedPack + ': expected '
      + set.pack_size + ' cards, got ' + result.packs[malformedPack].cards.length,
    );
  }

  for (const { rule, rarities } of rules) {
    const count = rarities.reduce((sum, rarity) => sum + (result.summary[rarity] ?? 0), 0);
    const current = ranges.get(rule.rarity) ?? { min: Infinity, max: -Infinity };
    current.min = Math.min(current.min, count);
    current.max = Math.max(current.max, count);
    ranges.set(rule.rarity, current);

    if (count < rule.min || count > rule.max) {
      errors.push(
        'box ' + index + ': ' + rule.rarity + ' expected '
        + rule.min + '-' + rule.max + ', got ' + count,
      );
    }
  }

  if (errors.length >= 20) break;
}

console.log(set.code + ' | ' + set.name_ko);
console.log('  shape: ' + set.box_size + ' packs x ' + set.pack_size + ' cards');
for (const { rule } of rules) {
  const range = ranges.get(rule.rarity);
  console.log(
    '  ' + rule.rarity + ': observed ' + range?.min + '-' + range?.max
    + ' | expected ' + rule.min + '-' + rule.max,
  );
}

if (errors.length > 0) {
  for (const error of errors) console.error('  ERROR: ' + error);
  process.exitCode = 1;
} else {
  console.log('  OK: ' + trials + ' boxes matched all supported guarantees');
}
