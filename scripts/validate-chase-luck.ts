import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import luckDefault from '../frontend/lib/luck.ts';
import type { Card, SetMeta } from '../frontend/lib/types.ts';

type ChaseCase = {
  setCode: string;
  cardNum: string;
  boxes?: number;
  packs?: number;
  minTierScore: number;
  label: string;
};

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createLuckOpening,
  scoreLuckSummaries,
  summarizeLuckEvent,
} = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');

const CASES: ChaseCase[] = [
  {
    setCode: 'm-inferno-x',
    cardNum: 'BS2025014110',
    boxes: 7,
    minTierScore: 1.3,
    label: 'Inferno X Mega Charizard X ex SAR in 7 boxes',
  },
  {
    setCode: 'm-inferno-x',
    cardNum: 'BS2025014116',
    boxes: 7,
    minTierScore: 1.3,
    label: 'Inferno X Mega Charizard X ex MUR in 7 boxes',
  },
  {
    setCode: 'm-dream-ex',
    cardNum: 'BS2025015250',
    boxes: 4,
    minTierScore: 1.3,
    label: 'MEGA Dream ex Mega Dragonite ex MUR in 4 boxes',
  },
  {
    setCode: 'm-start-deck-100',
    cardNum: 'BS2026001766',
    packs: 7,
    minTierScore: 1.55,
    label: 'Start Deck 100 Mega Charizard Y ex MUR in 7 decks',
  },
  {
    setCode: 'sv11b-black-bolt',
    cardNum: 'BS2025007174',
    boxes: 7,
    minTierScore: 1,
    label: 'Black Bolt Zekrom ex BWR in 7 boxes',
  },
  {
    setCode: 'sv11a-white-flare',
    cardNum: 'BS2025008174',
    boxes: 7,
    minTierScore: 1,
    label: 'White Flare Reshiram ex BWR in 7 boxes',
  },
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadSet(setCode: string): SetMeta {
  return readJson<SetMeta>(resolve(ROOT_DIR, 'data', 'sets', `${setCode}.json`));
}

function requireCard(set: SetMeta, cardNum: string): Card {
  const card = set.cards.find((candidate) => candidate.card_num === cardNum);
  if (!card) throw new Error(`${set.code}: missing chase card ${cardNum}`);
  return card;
}

function formatScore(score: number | undefined): string {
  return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(3) : 'n/a';
}

function main(): void {
  let errors = 0;

  for (const chaseCase of CASES) {
    const set = loadSet(chaseCase.setCode);
    const card = requireCard(set, chaseCase.cardNum);
    const opening = createLuckOpening(set, {
      boxes: chaseCase.boxes ?? 0,
      packs: chaseCase.packs ?? 0,
    });
    const summary = summarizeLuckEvent([card], opening, set);
    const score = scoreLuckSummaries([summary]);
    const price = card.price_ref_krw ?? 0;
    const ok = Boolean(score && score.luckTierScore >= chaseCase.minTierScore);

    console.log(
      [
        ok ? 'OK ' : 'ERR',
        chaseCase.label,
        `card=${card.card_num}`,
        `rarity=${card.rarity ?? 'UNKNOWN'}`,
        `price=${price.toLocaleString()} KRW`,
        `score=${formatScore(score?.luckTierScore)}`,
        `valueScore=${formatScore(score?.valueTierScore ?? undefined)}`,
        `percentile=${formatScore(score?.valuePercentile ?? undefined)}`,
        `min=${chaseCase.minTierScore.toFixed(3)}`,
      ].join(' | '),
    );

    if (!ok) errors++;
  }

  if (errors > 0) {
    console.error(`\n${errors} chase luck case(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nvalidated ${CASES.length} chase luck case(s).`);
  }
}

main();
