import type { Card, SetMeta } from './types';
import {
  DAILY_FORTUNE_COPY,
  type DailyFortuneGrade,
} from './dailyFortuneCopy';
import { raritySortRank } from './rarity';

export const DAILY_LUCK_SET_SOURCE_SLUGS = {
  'm5-abyss-eye': 'abyss-eye',
  'm4-ninja-spinner': 'ninja-spinner',
  'm-nihil-zero': 'nihil-zero',
  'm-dream-ex': 'mega-dream-ex',
  'm-inferno-x': 'inferno-x',
  'm-mega-brave': 'mega-brave',
  'm-mega-symphonia': 'mega-symphonia',
  'sv11b-black-bolt': 'black-bolt',
  'sv11a-white-flare': 'white-flare',
  'sv10-glory': 'glory-of-team-rocket',
} as const;

export const DAILY_LUCK_SET_CODES = Object.keys(
  DAILY_LUCK_SET_SOURCE_SLUGS,
) as Array<keyof typeof DAILY_LUCK_SET_SOURCE_SLUGS>;

export const DAILY_LUCK_WORST_VALUE_KRW: Record<
  keyof typeof DAILY_LUCK_SET_SOURCE_SLUGS,
  number
> = {
  'm5-abyss-eye': 8_000,
  'm4-ninja-spinner': 6_000,
  'm-nihil-zero': 6_000,
  'm-dream-ex': 9_000,
  'm-inferno-x': 5_000,
  'm-mega-brave': 6_000,
  'm-mega-symphonia': 6_000,
  'sv11b-black-bolt': 10_000,
  'sv11a-white-flare': 9_000,
  'sv10-glory': 5_000,
};

export const DAILY_LUCK_ROTATION_EPOCH = '2026-08-13';
export const DAILY_LUCK_BOX_COUNT = 1;

export interface DailyLuckResult {
  boxCount: number;
  boxPriceKrw: number;
  packCount: number;
  packCardNums: string[][];
  hitCardNums: string[];
  rarityCounts: Record<string, number>;
  hitCount: number;
  topCardNum: string | null;
  topRarity: string | null;
  observedValueKrw: number;
  scorePercentile: number;
  totalCards: number;
}

export interface DailyLuckLeaderboardEntry {
  rank: number;
  name: string;
  hitCardNums: string[];
  observedValueKrw: number;
  isMine: boolean;
}

export interface DailyLuckMine {
  rank: number;
  publicName: string;
  nicknamePublic: boolean;
  openedAt: string;
  result: DailyLuckResult;
}

export interface DailyLuckSnapshot {
  dayKst: string;
  isFinal: boolean;
  nextResetAt: string;
  setCode: string;
  setName: string;
  participantCount: number;
  leaderboard: DailyLuckLeaderboardEntry[];
  mine: DailyLuckMine | null;
}

export interface DailyLuckFortune {
  grade: DailyFortuneGrade;
  gradeLabel: string;
  gradeHanja: '大大吉' | '大吉' | '吉' | '中吉' | '小吉' | '末吉' | '凶' | '大凶';
  title: string;
  message: string;
  luckyNote: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDate(now = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function dateOrdinal(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS);
}

export function getDailyLuckSetCode(dayKst: string): (typeof DAILY_LUCK_SET_CODES)[number] {
  const offset = dateOrdinal(dayKst) - dateOrdinal(DAILY_LUCK_ROTATION_EPOCH);
  const index = ((offset % DAILY_LUCK_SET_CODES.length) + DAILY_LUCK_SET_CODES.length)
    % DAILY_LUCK_SET_CODES.length;
  return DAILY_LUCK_SET_CODES[index];
}

export function getDailyLuckSet(sets: SetMeta[], dayKst = getKstDate()): SetMeta | null {
  const setCode = getDailyLuckSetCode(dayKst);
  return sets.find((set) => set.code === setCode) ?? null;
}

export function getNextKstResetAt(dayKst: string): string {
  const [year, month, date] = dayKst.split('-').map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, date + 1) - KST_OFFSET_MS;
  return new Date(nextMidnightUtc).toISOString();
}

export function shortSetName(name: string): string {
  const quotedName = name.match(/「(.+)」/)?.[1];
  return quotedName ?? name;
}

const DAILY_LUCK_RESULT_MIN_RARITY_RANK = raritySortRank('AR');

export function isDailyLuckResultCard(card: Card): boolean {
  if (!card.rarity) return false;
  if (card.rarity === 'SR_ALT') return true;
  return raritySortRank(card.rarity, card) <= DAILY_LUCK_RESULT_MIN_RARITY_RANK;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function pickVariant<T>(items: readonly T[], key: string): T {
  return items[hashText(key) % items.length];
}

function getDailyFortuneGrade(
  result: DailyLuckResult,
  setCode: keyof typeof DAILY_LUCK_SET_SOURCE_SLUGS,
): DailyFortuneGrade {
  const boxPriceKrw = result.boxPriceKrw > 0 ? result.boxPriceKrw : 45_000;
  const valueRatio = result.observedValueKrw / boxPriceKrw;
  if (result.observedValueKrw < DAILY_LUCK_WORST_VALUE_KRW[setCode]) return 'worst';
  if (valueRatio >= 3) return 'legendary';
  if (valueRatio >= 1) return 'great';
  if (valueRatio >= 0.75) return 'blessing';
  if (valueRatio >= 0.5) return 'good';
  if (valueRatio >= 0.35) return 'small';
  if (valueRatio >= 0.25) return 'future';
  return 'bad';
}

export function getDailyLuckFortune(
  mine: DailyLuckMine,
  dayKst: string,
): DailyLuckFortune {
  const stableKey = [
    dayKst,
    mine.openedAt,
    mine.result.topCardNum ?? 'none',
    mine.result.observedValueKrw,
    mine.result.totalCards,
  ].join(':');
  const grade = getDailyFortuneGrade(mine.result, getDailyLuckSetCode(dayKst));
  const pool = DAILY_FORTUNE_COPY[grade];
  const hanjaByGrade: Record<DailyFortuneGrade, DailyLuckFortune['gradeHanja']> = {
    legendary: '大大吉',
    great: '大吉',
    blessing: '吉',
    good: '中吉',
    small: '小吉',
    future: '末吉',
    bad: '凶',
    worst: '大凶',
  };

  return {
    grade,
    gradeLabel: pool.label,
    gradeHanja: hanjaByGrade[grade],
    title: pickVariant(pool.titles, `${stableKey}:title`),
    message: pickVariant(pool.messages, `${stableKey}:message`),
    luckyNote: pickVariant(pool.luckyNotes, `${stableKey}:note`),
  };
}
