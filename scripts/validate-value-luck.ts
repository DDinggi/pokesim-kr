import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import luckDefault from '../frontend/lib/luck.ts';
import valueLuckDefault from '../frontend/lib/valueLuck.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

type SetIndex = {
  active_sets?: string[];
  planned_sets?: string[];
};

type Args = {
  setCode?: string;
  all: boolean;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { createLuckOpening, summarizeLuckRarityCounts } = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const {
  getCardReferenceValueKrw,
  getSetReferenceValueSource,
} = valueLuckDefault as unknown as typeof import('../frontend/lib/valueLuck.ts');

function parseArgs(argv: string[]): Args {
  const args: Args = { all: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--set') args.setCode = argv[++i];
    else if (arg === '--all') args.all = true;
  }

  return args;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadSet(setCode: string): SetMeta {
  return readJson<SetMeta>(resolve(ROOT_DIR, 'data', 'sets', `${setCode}.json`));
}

function getTargetSetCodes(args: Args): string[] {
  if (args.setCode) return [args.setCode];

  const index = readJson<SetIndex>(resolve(ROOT_DIR, 'data', 'sets-index.json'));
  if (args.all) return [...(index.active_sets ?? []), ...(index.planned_sets ?? [])];
  return index.active_sets ?? [];
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const setCodes = getTargetSetCodes(args);
  let errors = 0;
  let inactive = 0;

  for (const setCode of setCodes) {
    const set = loadSet(setCode);
    const opening = createLuckOpening(set, { boxes: 1 });
    const summary = summarizeLuckRarityCounts({}, opening, set);
    const expectedValue = summary.expectedValueKrw ?? 0;
    const pricedCards = set.cards.filter((card) => getCardReferenceValueKrw(card, set.code) > 0).length;

    if (pricedCards === 0 || expectedValue <= 0) {
      inactive++;
      console.log(`${set.code}: source_prices=${pricedCards}, value_luck=inactive (rarity fallback)`);
      continue;
    }

    if (!Number.isFinite(expectedValue)) {
      errors++;
      console.error(`${set.code}: invalid expected box reference value`);
      continue;
    }

    console.log(`${set.code}: source_prices=${pricedCards}, expected_box_value=${Math.round(expectedValue).toLocaleString()} KRW source=${getSetReferenceValueSource(set)}`);
  }

  console.log(`\nvalidated ${setCodes.length} set(s), inactive=${inactive}, errors=${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main();
