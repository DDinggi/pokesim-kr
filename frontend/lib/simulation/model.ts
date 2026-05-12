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

export const STANDARD_SV_HIGH_WEIGHTS: Record<string, number> = {
  SR: 70,
  SAR: 20,
  UR: 10,
};

export const SV11_HIGH_WEIGHTS: Record<string, number> = {
  SR: 70,
  SAR: 25,
  BWR: 5,
};

export const ACE_SPEC_SET_CODES = new Set([
  'sv7-stellar-miracle',
  'sv7a-paradise-dragona',
]);

export const STANDARD_SV_SET_RATES: Record<string, StandardSvSetRate> = {
  'sv9-battle-partners': {
    mandatoryHighWeights: { SR_POKEMON: 48.125, SR_TRAINER: 21.875, SAR: 20, UR: 10 },
    extraHighRate: 0.1,
    extraHighWeights: { SR_POKEMON: 68.75, SR_TRAINER: 31.25 },
    rrBaseCount: 4,
    rrExtraRate: 0.1,
    fillerWeights: { R: 84.17, RR: 15.83 },
  },
  'sv7-stellar-miracle': {
    mandatoryHighWeights: { SR_POKEMON: 43.75, SR_TRAINER: 26.25, SAR: 20, UR: 10 },
    extraHighRate: 0.1,
    extraHighWeights: { SR_POKEMON: 62.5, SR_TRAINER: 37.5 },
    rrBaseCount: 4,
    rrExtraRate: 0.1,
    fillerWeights: { R: 83.53, RR: 16.47 },
  },
  'sv7a-paradise-dragona': {
    mandatoryHighWeights: { SR_POKEMON: 43.75, SR_TRAINER: 26.25, SAR: 20, UR: 10 },
    extraHighRate: 0.1,
    extraHighWeights: { SR_POKEMON: 62.5, SR_TRAINER: 37.5 },
    rrBaseCount: 4,
    rrExtraRate: 0.1,
    fillerWeights: { R: 83.53, RR: 16.47 },
  },
};

export const STANDARD_EXTRA_SR_RATE = 0.1;
export const EXTRA_SR_RATE_BY_SET: Record<string, number> = {
  'sv1a-triplet': 0.05,
};
export const MEGA_EXTRA_SR_RATE = 0.1;
export const SV11_EXTRA_SR_RATE = 0.1;
export const MEGA_TRAINER_SLOT_WEIGHTS: Record<string, number> = { SR: 95, SAR: 5 };

export const MEGA_EXPANSION_FILLER_WEIGHTS: Record<string, number> = { R: 82, RR: 18 };
export const STANDARD_30_PACK_FILLER_WEIGHTS: Record<string, number> = { R: 85, RR: 15 };
export const STANDARD_20_PACK_FILLER_WEIGHTS: Record<string, number> = { R: 73, RR: 27 };

export const TERASTAL_EXTRA_SLOT_RATE = 0.4;
export const TERASTAL_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  SR: 20,
  SAR: 10,
  UR: 6,
};

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

export function getExtraSrRate(setCode: string | undefined, isSv11Special: boolean): number {
  if (isSv11Special) return SV11_EXTRA_SR_RATE;
  if (!setCode) return STANDARD_EXTRA_SR_RATE;
  return getStandardSvSetRate(setCode)?.extraHighRate ?? EXTRA_SR_RATE_BY_SET[setCode] ?? STANDARD_EXTRA_SR_RATE;
}
