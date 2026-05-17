import type { StandardSvSetRate } from './types';

export const PROBABILITY_META = {
  source: '저지맨 (포켓몬카드 MVC) + pokemon-infomation.com / altema.jp / snkrdunk',
  disclaimer:
    '봉입률은 커뮤니티 추정치입니다. 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않으며, 봉입 오류로 더 좋게/나쁘게 변동 가능합니다.',
  estimatedAt: '2026-05',
};

export const EXPANSION_MONSTER_WEIGHTS: Record<string, Record<string, number>> = {
  'm4-ninja-spinner': { SR: 70, SAR: 28, UR: 2 },
  'm-nihil-zero': { SR: 70, SAR: 28, UR: 2 },
  'm-inferno-x': { SR: 70, SAR: 28, UR: 2 },
  'm-mega-brave': { SR: 70, SAR: 28, UR: 2 },
  'm-mega-symphonia': { SR: 70, SAR: 28, UR: 2 },
};

export const EXPANSION_MONSTER_WEIGHTS_DEFAULT: Record<string, number> = {
  SR: 68,
  SAR: 30,
  UR: 2,
};

export const ACE_SPEC_SET_CODES = new Set([
  'sv5k-wild-force',
  'sv5m-cyber-judge',
  'sv5a-crimson-haze',
  'sv6-mask',
  'sv6a-night-wanderer',
  'sv7-stellar-miracle',
  'sv7a-paradise-dragona',
  'sv8-super-electric',
]);

const SV_SR_55_25: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 48.125, SR_TRAINER: 21.875, SAR: 20, UR: 10 },
  extraHighRate: 0.1,
  extraHighWeights: { SR_POKEMON: 68.75, SR_TRAINER: 31.25 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 15.83 },
};

const SV_SR_50_30: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 43.75, SR_TRAINER: 26.25, SAR: 20, UR: 10 },
  extraHighRate: 0.1,
  extraHighWeights: { SR_POKEMON: 62.5, SR_TRAINER: 37.5 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 83.53, RR: 16.47 },
};

const SV_SR_50_25: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 46.667, SR_TRAINER: 23.333, SAR: 20, UR: 10 },
  extraHighRate: 0.05,
  extraHighWeights: { SR_POKEMON: 66.667, SR_TRAINER: 33.333 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 83.53, RR: 16.47 },
};

const SV_SR_45_30: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 42, SR_TRAINER: 28, SAR: 20, UR: 10 },
  extraHighRate: 0.05,
  extraHighWeights: { SR_POKEMON: 60, SR_TRAINER: 40 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 83.53, RR: 16.47 },
};

const SV_TRIPLET_BEAT: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 42, SR_TRAINER: 28, SAR: 20, UR: 10 },
  extraHighRate: 0.05,
  extraHighWeights: { SR_POKEMON: 60, SR_TRAINER: 40 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 84.68, RR: 15.32 },
};

const SV_151: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 52.5, SR_TRAINER: 17.5, SAR: 20, UR: 10 },
  extraHighRate: 0.1,
  extraHighWeights: { SR_POKEMON: 75, SR_TRAINER: 25 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 78.73, RR: 21.27 },
};

export const STANDARD_SV_SET_RATES: Record<string, StandardSvSetRate> = {
  'sv1a-triplet': SV_TRIPLET_BEAT,
  'sv2a-151': SV_151,
  'sv3-black-flame-ruler': SV_SR_50_25,
  'sv3a-raging-surf': SV_SR_45_30,
  'sv4k-ancient-roar': SV_SR_55_25,
  'sv4m-future-flash': SV_SR_55_25,
  'sv5k-wild-force': SV_SR_55_25,
  'sv5m-cyber-judge': SV_SR_55_25,
  'sv5a-crimson-haze': SV_SR_50_30,
  'sv6-mask': SV_SR_55_25,
  'sv6a-night-wanderer': SV_SR_50_30,
  'sv7-stellar-miracle': SV_SR_50_30,
  'sv7a-paradise-dragona': SV_SR_50_30,
  'sv8-super-electric': SV_SR_55_25,
  'sv9-battle-partners': {
    ...SV_SR_55_25,
    extraHighWeights: { SR_POKEMON: 68.75, SR_TRAINER: 31.25 },
  },
  'sv9a-blazing-arena': SV_SR_55_25,
  'sv10-glory': SV_SR_50_30,
};

export const SV11_RR_COUNT = 4;
export const SV11_AR_COUNT = 4;
export const SV11_EXTRA_SR_RATE = 0.2;
export const SV11_OPTIONAL_TOP_WEIGHTS: Record<string, number> = {
  NONE: 70,
  SAR: 25,
  BWR: 5,
};

export const MEGA_EXTRA_SR_RATE = 0.1;
export const MEGA_RR_BASE_COUNT = 4;
export const MEGA_RR_EXTRA_RATE = 0.1;

export const MEGA_MAIN_SR_NUMBER_RANGES: Record<string, Array<[number, number]>> = {
  'm4-ninja-spinner': [[96, 103], [108, 111]],
  'm-nihil-zero': [[93, 100], [105, 108]],
  'm-inferno-x': [[93, 100], [105, 107]],
  'm-mega-brave': [[76, 80], [85, 86]],
  'm-mega-symphonia': [[76, 80], [84, 85]],
  'm-dream-ex': [[219, 221]],
};

export const TERASTAL_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 60,
  SR: 22,
  SAR: 11,
  UR: 7,
};

export const SHINY_TREASURE_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 40,
  SR: 30,
  SAR: 10,
  UR: 10,
  AR: 10,
};

export const VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 50,
  SAR: 20,
  SR: 20,
  UR: 10,
};

export const VSTAR_UNIVERSE_AR_GOD_PACK_RATE = 0.015;
export const VSTAR_UNIVERSE_SAR_GOD_PACK_RATE = 0.0225;

export const MEGA_DREAM_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 48,
  SR: 10,
  SAR: 40,
  UR: 2,
};

export const HI_CLASS_GOD_PACK_RATE = 0.0075;

export function isMegaExpansionSet(setCode?: string): boolean {
  return Boolean(setCode?.startsWith('m'));
}

export function isSv11SpecialSet(setCode?: string): boolean {
  return setCode === 'sv11a-white-flare' || setCode === 'sv11b-black-bolt';
}

export function hasAceSpecSlot(setCode?: string): boolean {
  return Boolean(setCode && ACE_SPEC_SET_CODES.has(setCode));
}

export function getStandardSvSetRate(setCode?: string): StandardSvSetRate | undefined {
  return setCode ? STANDARD_SV_SET_RATES[setCode] : undefined;
}
