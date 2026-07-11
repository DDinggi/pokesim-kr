import type { StandardHighKey, StandardSvSetRate } from './types';

export const PROBABILITY_META = {
  source: 'pokemon-infomation.com / altema.jp / snkrdunk',
  disclaimer:
    '봉입률은 커뮤니티 추정치입니다. 포켓몬코리아는 어떤 박스도 확정 봉입을 안내하지 않으며, 봉입 오류로 더 좋게/나쁘게 변동 가능합니다.',
  estimatedAt: '2026-05',
};

export const EXPANSION_MONSTER_WEIGHTS: Record<string, Record<string, number>> = {
  'm4-ninja-spinner': { SR: 70, SAR: 28, UR: 2 },
  'm5-abyss-eye': { SR: 71, SAR: 28, UR: 1 },
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

const SV_SCARLET_EX: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 45, SR_TRAINER: 30, SAR: 15, UR: 10 },
  extraHighRate: 0.05,
  extraHighWeights: { SR_POKEMON: 60, SR_TRAINER: 40 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 83.53, RR: 16.47 },
};

const SV_SNOW_CLAY: StandardSvSetRate = {
  mandatoryHighWeights: { SR_POKEMON: 52.5, SR_TRAINER: 17.5, SAR: 20, UR: 10 },
  extraHighRate: 0.1,
  extraHighWeights: { SR_POKEMON: 75, SR_TRAINER: 25 },
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  fillerWeights: { R: 83.53, RR: 16.47 },
};

const SWSH_FILLER_WEIGHTS = { R: 84.17, RR: 10.93, RRR: 4.9 };
const SM_FILLER_WEIGHTS = { R: 86.67, RR: 13.33 };

function normalizeHighWeights(
  weights: Partial<Record<StandardHighKey, number>>,
): Partial<Record<StandardHighKey, number>> {
  const total = Object.values(weights).reduce((sum, value) => sum + (value ?? 0), 0);
  if (total <= 0) return weights;

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, ((value ?? 0) / total) * 100]),
  ) as Partial<Record<StandardHighKey, number>>;
}

const SWSH_PARADIGM_TRIGGER: StandardSvSetRate = {
  mandatoryHighWeights: {
    SR_POKEMON: 33.333,
    SR_ALT: 14.286,
    SR_TRAINER: 23.81,
    HR_POKEMON: 9.524,
    HR_TRAINER: 9.524,
    UR: 9.524,
  },
  extraHighRate: 0.1,
  extraHighWeights: {
    SR_POKEMON: 33.333,
    SR_ALT: 14.286,
    SR_TRAINER: 23.81,
    HR_POKEMON: 9.524,
    HR_TRAINER: 9.524,
    UR: 9.524,
  },
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_LOST_ABYSS: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 35,
    SR_ALT: 15,
    SR_TRAINER: 25,
    HR_POKEMON: 10,
    HR_TRAINER: 10,
    UR: 10,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 35,
    SR_ALT: 15,
    SR_TRAINER: 25,
    HR_POKEMON: 10,
    HR_TRAINER: 10,
    UR: 10,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_TIME_SPACE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 45,
    SR_ALT: 12,
    SR_TRAINER: 25,
    HR_POKEMON: 9,
    HR_TRAINER: 9,
    UR: 10,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 45,
    SR_ALT: 12,
    SR_TRAINER: 25,
    HR_POKEMON: 9,
    HR_TRAINER: 9,
    UR: 10,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_CHARACTER_SUBSET: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 40,
    SR_TRAINER: 25,
    CSR: 10,
    HR_POKEMON: 10,
    HR_TRAINER: 10,
    UR: 10,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 40,
    SR_TRAINER: 25,
    CSR: 10,
    HR_POKEMON: 10,
    HR_TRAINER: 10,
    UR: 10,
  }),
  arCount: 0,
  chrCount: 3,
  kCount: 1,
  boxSize: 20,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_STAR_BIRTH: StandardSvSetRate = {
  mandatoryHighWeights: {
    SR_POKEMON: 36,
    SR_ALT: 14,
    SR_TRAINER: 24,
    HR_POKEMON: 10,
    HR_TRAINER: 8,
    UR: 8,
  },
  extraHighRate: 0.1,
  extraHighWeights: {
    SR_POKEMON: 36,
    SR_ALT: 14,
    SR_TRAINER: 24,
    HR_POKEMON: 10,
    HR_TRAINER: 8,
    UR: 8,
  },
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 10.93, RRR: 4.9 },
};

const SWSH_FUSION_ARTS: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_ALT: 3,
    SR_TRAINER: 4,
    HR_POKEMON: 5,
    HR_TRAINER: 4,
    UR: 5,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_ALT: 3,
    SR_TRAINER: 4,
    HR_POKEMON: 5,
    HR_TRAINER: 4,
    UR: 5,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 10.93, RRR: 4.9 },
};

const SWSH_SKY_STREAM: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 5,
    SR_ALT: 4,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 4,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 5,
    SR_ALT: 4,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 4,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 10.93, RRR: 4.9 },
};

const SWSH_POKEMON_GO: StandardSvSetRate = {
  mandatoryHighWeights: {
    SR_POKEMON: 40,
    SR_ALT: 8,
    SR_TRAINER: 30,
    HR_POKEMON: 10,
    HR_TRAINER: 10,
    UR: 10,
  },
  extraHighRate: 0.15,
  extraHighWeights: {
    SR_POKEMON: 36,
    SR_ALT: 7,
    SR_TRAINER: 27,
    HR_POKEMON: 9,
    HR_TRAINER: 9,
    UR: 9,
    GRA: 25,
  },
  kCount: 1,
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 10.93, RRR: 4.9 },
};

const SWSH_BATTLE_REGION: StandardSvSetRate = {
  mandatoryHighWeights: {
    SR_POKEMON: 40,
    CSR: 10,
    SR_TRAINER: 25,
    HR_POKEMON: 10,
    HR_TRAINER: 8,
    UR: 7,
  },
  extraHighRate: 0.1,
  extraHighWeights: {
    SR_POKEMON: 40,
    CSR: 10,
    SR_TRAINER: 25,
    HR_POKEMON: 10,
    HR_TRAINER: 8,
    UR: 7,
  },
  kCount: 1,
  chrCount: 3,
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: { R: 84.17, RR: 10.93, RRR: 4.9 },
};

const SWSH_EEVEE_HEROES: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 30,
    SR_ALT: 30,
    SR_TRAINER: 15,
    HR_POKEMON: 15,
    HR_TRAINER: 10,
    UR: 10,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 30,
    SR_ALT: 30,
    SR_TRAINER: 15,
    HR_POKEMON: 15,
    HR_TRAINER: 10,
    UR: 10,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_SILVER_LANCE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 3,
    SR_TRAINER: 4,
    HR_POKEMON: 4,
    HR_TRAINER: 4,
    UR: 4,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 3,
    SR_TRAINER: 4,
    HR_POKEMON: 4,
    HR_TRAINER: 4,
    UR: 4,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S4_VOLT_TACKLE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 3,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 3,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S3A_LEGENDARY_HEARTBEAT: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_TRAINER: 3,
    HR_POKEMON: 3,
    HR_TRAINER: 3,
    UR: 3,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_TRAINER: 3,
    HR_POKEMON: 3,
    HR_TRAINER: 3,
    UR: 3,
  }),
  aCount: 1,
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S3_EARLY_V_SERIES: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_TRAINER: 2,
    HR_POKEMON: 4,
    HR_TRAINER: 2,
    UR: 3,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 8,
    SR_TRAINER: 2,
    HR_POKEMON: 4,
    HR_TRAINER: 2,
    UR: 3,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S2A_EXPLOSIVE_WALKER: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_TRAINER: 2,
    HR_POKEMON: 3,
    HR_TRAINER: 2,
    UR: 3,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_TRAINER: 2,
    HR_POKEMON: 3,
    HR_TRAINER: 2,
    UR: 3,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S1_BASE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 56.25,
    SR_TRAINER: 18.75,
    HR_POKEMON: 8.333,
    HR_TRAINER: 8.333,
    UR: 8.334,
  }),
  extraHighRate: 0,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 56.25,
    SR_TRAINER: 18.75,
    HR_POKEMON: 8.333,
    HR_TRAINER: 8.333,
    UR: 8.334,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.5,
  rrrBaseCount: 1,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_S1A_VMAX_RISING: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 52.5,
    SR_TRAINER: 17.5,
    HR_POKEMON: 12,
    HR_TRAINER: 8,
    UR: 10,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 52.5,
    SR_TRAINER: 17.5,
    HR_POKEMON: 12,
    HR_TRAINER: 8,
    UR: 10,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SM_DREAM_LEAGUE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 40,
    SR_TRAINER: 30,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 40,
    SR_TRAINER: 30,
    HR_POKEMON: 20,
    UR: 10,
  }),
  chrCount: 3,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM_ALTER_GENESIS: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 53.846,
    SR_TRAINER: 16.154,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 53.846,
    SR_TRAINER: 16.154,
    HR_POKEMON: 20,
    UR: 10,
  }),
  trCount: 1,
  trExtraRate: 1 / 12,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const DETECTIVE_PIKACHU: StandardSvSetRate = {
  mandatoryHighWeights: { SR_TRAINER: 100 },
  extraHighRate: 0,
  extraHighWeights: { SR_TRAINER: 100 },
  arCount: 0,
  boxSize: 20,
  rrBaseCount: 2,
  rrExtraRate: 3 / 8,
  fillerWeights: { C: 75, U: 25 },
};

const SM_TAG_BOLT: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 30,
    SR_ALT: 25,
    SR_TRAINER: 15,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 30,
    SR_ALT: 25,
    SR_TRAINER: 15,
    HR_POKEMON: 20,
    UR: 10,
  }),
  trCount: 1,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM_DARK_ORDER: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 46.667,
    SR_TRAINER: 23.333,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 46.667,
    SR_TRAINER: 23.333,
    HR_POKEMON: 20,
    UR: 10,
  }),
  prCount: 1,
  arCount: 0,
  boxSize: 20,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM7A_PLASMA_SPARK: StandardSvSetRate = {
  ...SM_DARK_ORDER,
};

const SM8_BURST_IMPACT: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 43.75,
    SR_TRAINER: 26.25,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 43.75,
    SR_TRAINER: 26.25,
    HR_POKEMON: 20,
    UR: 10,
  }),
  prCount: 1,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM4PLUS_GX_BATTLE_BOOST_REMASTER: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 35,
    SR_TRAINER: 35,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 35,
    SR_TRAINER: 35,
    HR_POKEMON: 20,
    UR: 10,
  }),
  arCount: 0,
  boxSize: 20,
  rrBaseCount: 18,
  rrExtraRate: 0,
  fillerWeights: { R: 100 },
};

const SM10_TR_SERIES: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 52.5,
    SR_TRAINER: 17.5,
    HR_POKEMON: 20,
    UR: 10,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 52.5,
    SR_TRAINER: 17.5,
    HR_POKEMON: 20,
    UR: 10,
  }),
  trCount: 1,
  trExtraRate: 1 / 12,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM11_MIRACLE_TWIN: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 9,
    SR_TRAINER: 3,
    HR_POKEMON: 6,
    UR: 3,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 9,
    SR_TRAINER: 3,
    HR_POKEMON: 6,
    UR: 3,
  }),
  trCount: 1,
  trExtraRate: 1 / 12,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SM11A_REMIX_BOUT: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 7,
    SR_TRAINER: 2,
    HR_POKEMON: 4,
    UR: 3,
  }),
  extraHighRate: 1 / 12,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 7,
    SR_TRAINER: 2,
    HR_POKEMON: 4,
    UR: 3,
  }),
  trCount: 1,
  trExtraRate: 1 / 12,
  arCount: 0,
  rrBaseCount: 3,
  rrExtraRate: 1 / 3,
  fillerWeights: SM_FILLER_WEIGHTS,
};

const SWSH_SINGLE_RAPID_STRIKE: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 2,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 3,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 2,
    SR_TRAINER: 3,
    HR_POKEMON: 4,
    HR_TRAINER: 3,
    UR: 3,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

const SWSH_MATCHLESS_FIGHTERS: StandardSvSetRate = {
  mandatoryHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 4,
    SR_TRAINER: 4,
    HR_POKEMON: 4,
    HR_TRAINER: 4,
    UR: 4,
  }),
  extraHighRate: 0.1,
  extraHighWeights: normalizeHighWeights({
    SR_POKEMON: 6,
    SR_ALT: 4,
    SR_TRAINER: 4,
    HR_POKEMON: 4,
    HR_TRAINER: 4,
    UR: 4,
  }),
  arCount: 0,
  rrBaseCount: 4,
  rrExtraRate: 0.1,
  rrrBaseCount: 2,
  rrrExtraRate: 0.1,
  fillerWeights: SWSH_FILLER_WEIGHTS,
};

export const ANNIVERSARY_25_SET_CODE = 's8a-25th-anniversary';
export const ANNIVERSARY_25_BOX_SIZE = 16;
export const ANNIVERSARY_25_BASE_RARITY = '25TH';
export const ANNIVERSARY_25_PROMO_RARITY = 'S8AP';
export const ANNIVERSARY_25_PROMO_INTERVAL = 4;
export const ANNIVERSARY_25_HIT_WEIGHTS: Record<string, number> = {
  '25TH': 17,
  RR: 5,
  RRR: 2,
};
export const ANNIVERSARY_25_LUCK_SCORE_WEIGHTS: Record<string, number> = {
  S8AP: 1,
  '25TH': 0,
  RR: 0.2,
  RRR: 1,
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
  'sv1s-scarlet-ex': SV_SCARLET_EX,
  'sv1v-violet-ex': SV_SR_45_30,
  'sv1a-triplet': SV_TRIPLET_BEAT,
  'sv2p-snow-hazard': SV_SNOW_CLAY,
  'sv2d-clay-burst': SV_SNOW_CLAY,
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
  's12-paradigm-trigger': SWSH_PARADIGM_TRIGGER,
  's11a-incandescent-arcana': SWSH_CHARACTER_SUBSET,
  's11-lost-abyss': SWSH_LOST_ABYSS,
  's10b-pokemon-go': SWSH_POKEMON_GO,
  's10a-dark-phantasma': SWSH_CHARACTER_SUBSET,
  's10d-time-gazer': SWSH_TIME_SPACE,
  's10p-space-juggler': SWSH_TIME_SPACE,
  's9a-battle-region': SWSH_BATTLE_REGION,
  's9-star-birth': SWSH_STAR_BIRTH,
  's8-fusion-arts': SWSH_FUSION_ARTS,
  's7r-sky-stream': SWSH_SKY_STREAM,
  's6a-eevee-heroes': SWSH_EEVEE_HEROES,
  's6h-silver-lance': SWSH_SILVER_LANCE,
  's6k-jet-black-spirit': SWSH_SILVER_LANCE,
  's5a-matchless-fighters': SWSH_MATCHLESS_FIGHTERS,
  's5i-single-strike-master': SWSH_SINGLE_RAPID_STRIKE,
  's5r-rapid-strike-master': SWSH_SINGLE_RAPID_STRIKE,
  's4-amazing-volt-tackle': SWSH_S4_VOLT_TACKLE,
  's3a-legendary-heartbeat': SWSH_S3A_LEGENDARY_HEARTBEAT,
  's3-infinity-zone': SWSH_S3_EARLY_V_SERIES,
  's2a-explosive-walker': SWSH_S2A_EXPLOSIVE_WALKER,
  's2-rebellion-crash': SWSH_S3_EARLY_V_SERIES,
  's1a-vmax-rising': SWSH_S1A_VMAX_RISING,
  's1w-sword': SWSH_S1_BASE,
  's1h-shield': SWSH_S1_BASE,
  'sm12-alter-genesis': SM_ALTER_GENESIS,
  'sm11b-dream-league': SM_DREAM_LEAGUE,
  'sm11a-remix-bout': SM11A_REMIX_BOUT,
  'sm11-miracle-twin': SM11_MIRACLE_TWIN,
  'smp2-detective-pikachu': DETECTIVE_PIKACHU,
  'sm7a-plasma-spark': SM7A_PLASMA_SPARK,
  'sm4plus-gx-battle-boost-remaster': SM4PLUS_GX_BATTLE_BOOST_REMASTER,
  'sm8-burst-impact': SM8_BURST_IMPACT,
  'sm9-tag-bolt': SM_TAG_BOLT,
  'sm8a-dark-order': SM_DARK_ORDER,
  'sm9b-full-metal-wall': SM10_TR_SERIES,
  'sm9a-night-unison': SM10_TR_SERIES,
  'sm10b-sky-legend': SM10_TR_SERIES,
  'sm10a-gg-end': SM10_TR_SERIES,
  'sm10-double-blaze': SM10_TR_SERIES,
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
export const MEGA_AR_COUNT = 3;

export const MEGA_MAIN_SR_NUMBER_RANGES: Record<string, Array<[number, number]>> = {
  'm4-ninja-spinner': [[96, 103], [108, 111]],
  'm5-abyss-eye': [[94, 101], [108, 111]],
  'm-nihil-zero': [[93, 100], [105, 108]],
  'm-inferno-x': [[93, 100], [105, 107]],
  'm-mega-brave': [[76, 80], [85, 86]],
  'm-mega-symphonia': [[76, 80], [84, 85]],
  'm-dream-ex': [[219, 221]],
};

export const ALT_SR_NUMBER_RANGES: Record<string, Array<[number, number]>> = {
  'sm9-tag-bolt': [[97, 97], [99, 99], [101, 101], [103, 103], [105, 105]],
  's12-paradigm-trigger': [[107, 110]],
  's11-lost-abyss': [[104, 104], [106, 106], [109, 109], [111, 111]],
  's10b-pokemon-go': [[74, 76]],
  's10d-time-gazer': [[69, 69], [73, 73], [75, 75]],
  's10p-space-juggler': [[69, 69], [71, 71], [75, 75]],
  's9-star-birth': [[103, 103], [105, 105], [109, 109], [112, 112]],
  's8-fusion-arts': [[106, 106], [109, 109], [111, 111]],
  's7r-sky-stream': [[72, 72], [74, 74], [76, 76]],
  's6a-eevee-heroes': [[71, 71], [73, 73], [75, 75], [77, 77], [79, 79], [81, 81], [83, 83], [85, 85]],
  's6k-jet-black-spirit': [[74, 74], [76, 76], [79, 79]],
  's6h-silver-lance': [[73, 73], [75, 75], [79, 79]],
  's5a-matchless-fighters': [[74, 74], [76, 76], [78, 78], [80, 80]],
  's5r-rapid-strike-master': [[74, 74], [77, 77]],
  's5i-single-strike-master': [[75, 75], [77, 77]],
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

export const SHINY_STAR_V_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 50,
  SR: 40,
  UR: 10,
};

export const GX_ULTRA_SHINY_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 50,
  SR: 35,
  UR: 15,
};

// Contemporary opening summaries only establish a 1-2 PR range, so use its midpoint.
export const GX_ULTRA_SHINY_SECOND_PR_RATE = 0.5;

export const VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 50,
  SAR: 20,
  SR: 20,
  UR: 10,
};

export const VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 40,
  SR: 50,
  GRA: 10,
};

export const VMAX_CLIMAX_SR_GOD_PACK_RATE = 0.015;
export const VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE = 0.01;

export const TAG_ALL_STARS_MAIN_SLOT_WEIGHTS: Record<string, number> = {
  SR: 70,
  HR: 20,
  UR: 10,
};

export const TAG_ALL_STARS_GOD_PACK_PACK_RATE = 1 / 250;
export const TAG_ALL_STARS_GOD_PACK_RATE = 1 - (1 - TAG_ALL_STARS_GOD_PACK_PACK_RATE) ** 10;

export const VSTAR_UNIVERSE_AR_GOD_PACK_RATE = 0.015;
export const VSTAR_UNIVERSE_SAR_GOD_PACK_RATE = 0.0225;

export const MEGA_DREAM_EXTRA_SLOT_WEIGHTS: Record<string, number> = {
  NONE: 48,
  SR: 10,
  SAR: 40,
  UR: 2,
};


/**
 * 스타트 덱 100 (배틀 컬렉션). 코드가 'm'으로 시작하지만 MEGA 확장팩 봉입률 모델이
 * 아니라 "101개 덱 중 1개 무작위" 제품이라 별도 starter 경로로 처리한다.
 */
export const STARTER_SET_CODES = new Set(['m-start-deck-100']);

/** 특수 덱(101번, 대표 SAR 3장) 등장 확률(잠정 추정치 -- 실데이터 확보 시 갱신). */
export const STARTER_SPECIAL_DECK_RATE = 0.01;
/** 골드 001번 변형 덱(#766 MUR) 등장 확률(잠정 추정치 -- 실데이터 확보 시 갱신). */
export const STARTER_GOLD_DECK_RATE = 0.01;
/**
 * 대표카드는 AR 이상만(일반 덱 풀 = AR 14 + SR 4 + SAR 2 = 20장).
 * 특수 101번 덱: SAR 3장 / 골드 001번 변형: #766 MUR 1장. (둘 다 1% 잠정 추정)
 *
 * 운(가치 기반) 모델 기준선은 '평범한 AR/SR 뽑기'로 잡는다. SAR/특수/골드는 잭팟이라
 * 기대치에 넣지 않아야 평범한 뽑기가 mid 등급으로 나오고 잭팟이 서프라이즈가 된다.
 */
export const STARTER_NORMAL_POOL_SIZE = 20;
export const STARTER_NORMAL_AR_COUNT = 14;
export const STARTER_NORMAL_SR_COUNT = 4;
export const STARTER_NORMAL_SAR_COUNT = 2;
export const STARTER_STANDARD_DECK_RATE = 1 - STARTER_SPECIAL_DECK_RATE - STARTER_GOLD_DECK_RATE;
export const STARTER_SPECIAL_SAR_COUNT = 3;
export const STARTER_AR_RATE = STARTER_STANDARD_DECK_RATE * (STARTER_NORMAL_AR_COUNT / STARTER_NORMAL_POOL_SIZE);
export const STARTER_SR_RATE = STARTER_STANDARD_DECK_RATE * (STARTER_NORMAL_SR_COUNT / STARTER_NORMAL_POOL_SIZE);
export const STARTER_STANDARD_SAR_RATE = STARTER_STANDARD_DECK_RATE * (STARTER_NORMAL_SAR_COUNT / STARTER_NORMAL_POOL_SIZE);
export const STARTER_UR_RATE = STARTER_GOLD_DECK_RATE;
export const STARTER_SAR_RATE = STARTER_STANDARD_SAR_RATE + STARTER_SPECIAL_DECK_RATE * STARTER_SPECIAL_SAR_COUNT;

export function isStarterSet(setCode?: string): boolean {
  return Boolean(setCode && STARTER_SET_CODES.has(setCode));
}

export function isMegaExpansionSet(setCode?: string): boolean {
  return Boolean(setCode?.startsWith('m')) && !isStarterSet(setCode);
}

export function isSv11SpecialSet(setCode?: string): boolean {
  return setCode === 'sv11a-white-flare' || setCode === 'sv11b-black-bolt';
}

export function hasAceSpecSlot(setCode?: string): boolean {
  return Boolean(setCode && ACE_SPEC_SET_CODES.has(setCode));
}

export function isAnniversary25Set(setCode?: string): boolean {
  return setCode === ANNIVERSARY_25_SET_CODE;
}

export function getStandardSvSetRate(setCode?: string): StandardSvSetRate | undefined {
  return setCode ? STANDARD_SV_SET_RATES[setCode] : undefined;
}
