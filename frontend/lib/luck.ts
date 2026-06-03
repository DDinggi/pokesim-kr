import type { Card, SetMeta } from './types';
import { isMegaContext } from './rarity';
import {
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
  HI_CLASS_GOD_PACK_RATE,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_EXTRA_SR_RATE,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  SV11_EXTRA_SR_RATE,
  SV11_OPTIONAL_TOP_WEIGHTS,
  TERASTAL_EXTRA_SLOT_WEIGHTS,
  VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE,
  VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS,
  VMAX_CLIMAX_SR_GOD_PACK_RATE,
  VSTAR_UNIVERSE_AR_GOD_PACK_RATE,
  VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS,
  VSTAR_UNIVERSE_SAR_GOD_PACK_RATE,
  getStandardSvSetRate,
  isMegaExpansionSet,
  isStarterSet,
  isSv11SpecialSet,
  STARTER_GOLD_DECK_RATE,
  STARTER_SAR_RATE,
  STARTER_SPECIAL_DECK_RATE,
  STARTER_SPECIAL_SAR_COUNT,
  STARTER_SR_RATE,
  STARTER_STANDARD_SAR_RATE,
  STARTER_UR_RATE,
} from './simulation/model';

const DEFAULT_BOX_SIZE = 30;

export interface LuckOpening {
  setCode: string;
  boxes: number;
  packs: number;
  boxSize: number;
  topPerBox: number;
  sarPerBox: number;
}

export interface LuckEventSummary {
  topCount: number;
  sarCount: number;
  topExpected: number;
  sarExpected: number;
  observedScore?: number;
  expectedScore?: number;
  scoreCounts?: Record<string, number>;
  expectedScoreCounts?: Record<string, number>;
  scoreDistribution?: LuckScoreOutcome[];
  openingUnits?: number;
}

export interface LuckScoreOutcome {
  score: number;
  probability: number;
}

export interface WeightedLuckScore extends LuckEventSummary {
  observedScore: number;
  expectedScore: number;
  luckTierScore: number;
  luckZScore: number;
  luckBand: LuckBand;
  isLucky: boolean;
  scoreCounts: Record<string, number>;
}

export type LuckBand = 'lucky' | 'average' | 'unlucky';

const TOP_RARITY_WEIGHT = 3;
const OLD_HIGH_RARITIES = ['SR', 'CSR', 'HR', 'SAR', 'UR', 'GRA'] as const;
const SCORE_EPSILON = 1e-9;
const SCORE_WEIGHTS: Record<string, number> = {
  SSR: 0.5,
  SR: 0.5,
  CSR: 1,
  MA: 0.5,
  HR: 1,
  SAR: 2,
  UR: 3,
  GRA: 3,
  BWR: 3,
};
const PACK_SCORE_WEIGHTS: Record<string, number> = {
  SR: 1,
  CSR: 2,
  SSR: 1,
  MA: 1,
  HR: 2,
  SAR: 2,
  UR: 3,
  GRA: 3,
  BWR: 3,
};
const LUCK_COMBINATION_RULES = {
  primaryHitKeys: ['MUR', 'BWR', 'UR', 'GRA', 'HR', 'SAR'],
  secondaryHitKeys: ['MA', 'SSR', 'CSR', 'SR'],
  rarityMultiplier: {
    MUR: 1.2,
    BWR: 1.2,
    UR: 0.95,
    GRA: 0.95,
    SAR: 1,
    HR: 0.75,
    CSR: 0.4,
    MA: 0.25,
    SSR: 0.25,
    SR: 0.18,
  },
  primaryScoreCap: 2.75,
  primaryActivationScore: 0.15,
  secondaryScoreCap: 0.2,
  droughtBasePenalty: 0.15,
  droughtMultiplier: 1.85,
  droughtScoreCap: 2.25,
  baselineMinScore: -2,
  baselineMaxScore: 0.15,
} as const;
const PRIMARY_LUCK_KEYS = new Set<string>(LUCK_COMBINATION_RULES.primaryHitKeys);
const SECONDARY_LUCK_KEYS = new Set<string>(LUCK_COMBINATION_RULES.secondaryHitKeys);

/*
 * Luck tier rule for every current and future set:
 * - Each set model first produces expected hit counts per box/pack in getExpectedScoredRarityCounts().
 * - Primary hits (MUR/BWR/UR/HR/SAR) use upper-tail probability P(X >= observed).
 *   Multiple primary hits are combined by summing -log10(probability) with rarity multipliers.
 * - Secondary hits (MA/SSR/SR) can appear in the UI but are capped, so SR volume alone cannot make a top tier.
 * - If primary hits are below expectation, lower-tail probability P(X <= observed) becomes a drought penalty.
 * New boxes should only need their expected hit model added; the tier rule stays shared here.
 */

function weightChance(weights: Record<string, number>, key: string): number {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return total > 0 ? (weights[key] ?? 0) / total : 0;
}

type LuckScoreMode = 'box' | 'pack';

function getScoreWeight(rarity: string, mode: LuckScoreMode): number {
  return (mode === 'pack' ? PACK_SCORE_WEIGHTS : SCORE_WEIGHTS)[rarity] ?? 0;
}

function normalizeDistribution(outcomes: LuckScoreOutcome[]): LuckScoreOutcome[] {
  const byScore = new Map<number, number>();
  for (const outcome of outcomes) {
    if (outcome.probability <= 0) continue;
    byScore.set(outcome.score, (byScore.get(outcome.score) ?? 0) + outcome.probability);
  }

  const total = Array.from(byScore.values()).reduce((sum, probability) => sum + probability, 0);
  if (total <= 0) return [{ score: 0, probability: 1 }];

  return Array.from(byScore.entries())
    .map(([score, probability]) => ({ score, probability: probability / total }))
    .sort((a, b) => a.score - b.score);
}

function convolveDistributions(
  a: LuckScoreOutcome[],
  b: LuckScoreOutcome[],
): LuckScoreOutcome[] {
  const outcomes: LuckScoreOutcome[] = [];
  for (const left of a) {
    for (const right of b) {
      outcomes.push({
        score: left.score + right.score,
        probability: left.probability * right.probability,
      });
    }
  }
  return normalizeDistribution(outcomes);
}

function repeatDistribution(base: LuckScoreOutcome[], count: number): LuckScoreOutcome[] {
  let distribution: LuckScoreOutcome[] = [{ score: 0, probability: 1 }];
  for (let i = 0; i < count; i++) {
    distribution = convolveDistributions(distribution, base);
  }
  return distribution;
}

function distributionExpectedScore(distribution: LuckScoreOutcome[]): number {
  return distribution.reduce((sum, outcome) => sum + outcome.score * outcome.probability, 0);
}

function distributionStdDev(distribution: LuckScoreOutcome[], mean: number): number {
  const variance = distribution.reduce(
    (sum, outcome) => sum + (outcome.score - mean) ** 2 * outcome.probability,
    0,
  );
  return Math.sqrt(Math.max(0, variance));
}

function poissonTailAtLeast(expected: number, observed: number): number {
  if (observed <= 0) return 1;
  if (expected <= SCORE_EPSILON) return observed > 0 ? SCORE_EPSILON : 1;

  let term = Math.exp(-expected);
  let cumulative = term;

  for (let count = 1; count < observed; count++) {
    term *= expected / count;
    cumulative += term;
  }

  return Math.max(SCORE_EPSILON, Math.min(1, 1 - cumulative));
}

function poissonCdfAtMost(expected: number, observed: number): number {
  if (observed < 0) return 0;
  if (expected <= SCORE_EPSILON) return 1;

  let term = Math.exp(-expected);
  let cumulative = term;

  for (let count = 1; count <= observed; count++) {
    term *= expected / count;
    cumulative += term;
  }

  return Math.max(SCORE_EPSILON, Math.min(1, cumulative));
}

function getRaritySurpriseScore(
  counts: Record<string, number>,
  expectedCounts: Record<string, number> | undefined,
  allowedKeys?: Set<string>,
): number {
  if (!expectedCounts) return 0;

  return Object.entries(counts).reduce((best, [rarity, count]) => {
    if (allowedKeys && !allowedKeys.has(rarity)) return best;
    if (count <= 0) return best;
    const expected = expectedCounts[rarity] ?? 0;
    if (count <= expected) return best;
    const multiplier = LUCK_COMBINATION_RULES.rarityMultiplier[rarity as keyof typeof LUCK_COMBINATION_RULES.rarityMultiplier] ?? 0.5;
    const score = -Math.log10(poissonTailAtLeast(expected, count)) * multiplier;
    return Math.max(best, score);
  }, 0);
}

function getCombinedRaritySurpriseScore(
  counts: Record<string, number>,
  expectedCounts: Record<string, number> | undefined,
  allowedKeys: Set<string>,
): number {
  if (!expectedCounts) return 0;

  const score = Object.entries(counts).reduce((sum, [rarity, count]) => {
    if (!allowedKeys.has(rarity) || count <= 0) return sum;
    const expected = expectedCounts[rarity] ?? 0;
    if (count <= expected) return sum;
    const multiplier = LUCK_COMBINATION_RULES.rarityMultiplier[rarity as keyof typeof LUCK_COMBINATION_RULES.rarityMultiplier] ?? 0.5;
    return sum + -Math.log10(poissonTailAtLeast(expected, count)) * multiplier;
  }, 0);

  return Math.min(LUCK_COMBINATION_RULES.primaryScoreCap, score);
}

function sumAllowedCounts(
  counts: Record<string, number> | undefined,
  allowedKeys: Set<string>,
): number {
  return Array.from(allowedKeys).reduce((sum, key) => sum + (counts?.[key] ?? 0), 0);
}

function getPrimaryDroughtTierScore(
  counts: Record<string, number>,
  expectedCounts: Record<string, number> | undefined,
): number {
  if (!expectedCounts) return 0;

  const observed = Math.floor(sumAllowedCounts(counts, PRIMARY_LUCK_KEYS));
  const expected = sumAllowedCounts(expectedCounts, PRIMARY_LUCK_KEYS);
  if (expected <= SCORE_EPSILON || observed >= expected) return 0;

  const droughtScore = -Math.log10(poissonCdfAtMost(expected, observed));
  return -Math.min(
    LUCK_COMBINATION_RULES.droughtScoreCap,
    LUCK_COMBINATION_RULES.droughtBasePenalty + droughtScore * LUCK_COMBINATION_RULES.droughtMultiplier,
  );
}

function getLuckBand(luckZScore: number): LuckBand {
  if (luckZScore >= 1) return 'lucky';
  if (luckZScore <= -1.75) return 'unlucky';
  return 'average';
}

export function scoreLuckSummary(summary: LuckEventSummary): WeightedLuckScore | null {
  const observedScore = summary.observedScore ?? summary.sarCount + summary.topCount * TOP_RARITY_WEIGHT;
  const expectedScore = summary.expectedScore
    ?? (summary.scoreDistribution ? distributionExpectedScore(summary.scoreDistribution) : summary.sarExpected + summary.topExpected * TOP_RARITY_WEIGHT);
  if (expectedScore < 0) return null;

  const stdDev = summary.scoreDistribution ? distributionStdDev(summary.scoreDistribution, expectedScore) : 0;
  const luckZScore = stdDev > SCORE_EPSILON ? (observedScore - expectedScore) / stdDev : 0;
  const scoreCounts = summary.scoreCounts ?? {
    SAR: summary.sarCount,
    TOP: summary.topCount,
  };
  const primarySurpriseScore = getCombinedRaritySurpriseScore(
    scoreCounts,
    summary.expectedScoreCounts,
    PRIMARY_LUCK_KEYS,
  );
  const secondarySurpriseScore = Math.min(
    LUCK_COMBINATION_RULES.secondaryScoreCap,
    getRaritySurpriseScore(scoreCounts, summary.expectedScoreCounts, SECONDARY_LUCK_KEYS),
  );
  const droughtTierScore = getPrimaryDroughtTierScore(scoreCounts, summary.expectedScoreCounts);
  const baselineTierScore = Math.max(
    LUCK_COMBINATION_RULES.baselineMinScore,
    Math.min(LUCK_COMBINATION_RULES.baselineMaxScore, luckZScore),
  );
  const secondaryOrBaselineScore = Math.max(secondarySurpriseScore, baselineTierScore);
  const luckTierScore =
    primarySurpriseScore >= LUCK_COMBINATION_RULES.primaryActivationScore ? primarySurpriseScore
    : secondaryOrBaselineScore > 0 ? secondaryOrBaselineScore
    : droughtTierScore < 0 ? droughtTierScore
    : secondaryOrBaselineScore;
  const luckBand = getLuckBand(luckZScore);
  const isLucky = luckBand === 'lucky';

  return {
    ...summary,
    observedScore,
    expectedScore,
    luckTierScore,
    luckZScore,
    luckBand,
    isLucky,
    scoreCounts,
  };
}

export function scoreLuckSummaries(summaries: LuckEventSummary[]): WeightedLuckScore | null {
  return scoreLuckSummary(
    summaries.reduce<LuckEventSummary>(
      (total, summary) => {
        const scoreDistribution = total.scoreDistribution && summary.scoreDistribution
          ? convolveDistributions(total.scoreDistribution, summary.scoreDistribution)
          : total.scoreDistribution ?? summary.scoreDistribution;

        return {
          topCount: total.topCount + summary.topCount,
          sarCount: total.sarCount + summary.sarCount,
          topExpected: total.topExpected + summary.topExpected,
          sarExpected: total.sarExpected + summary.sarExpected,
          observedScore: (total.observedScore ?? 0) + (summary.observedScore ?? summary.sarCount + summary.topCount * TOP_RARITY_WEIGHT),
          expectedScore: scoreDistribution
            ? distributionExpectedScore(scoreDistribution)
            : (total.expectedScore ?? 0) + (summary.expectedScore ?? summary.sarExpected + summary.topExpected * TOP_RARITY_WEIGHT),
          scoreCounts: mergeScoreCounts(total.scoreCounts, summary.scoreCounts),
          expectedScoreCounts: mergeScoreCounts(total.expectedScoreCounts, summary.expectedScoreCounts),
          scoreDistribution,
          openingUnits: (total.openingUnits ?? 0) + (summary.openingUnits ?? 0),
        };
      },
      {
        topCount: 0,
        sarCount: 0,
        topExpected: 0,
        sarExpected: 0,
        observedScore: 0,
        expectedScore: 0,
        scoreCounts: {},
        expectedScoreCounts: {},
        scoreDistribution: [{ score: 0, probability: 1 }],
        openingUnits: 0,
      },
    ),
  );
}

function mergeScoreCounts(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): Record<string, number> {
  const merged: Record<string, number> = { ...(a ?? {}) };
  for (const [rarity, count] of Object.entries(b ?? {})) {
    merged[rarity] = (merged[rarity] ?? 0) + count;
  }
  return merged;
}

function getLuckScoreWeightsForSet(
  setOrOpening: Pick<SetMeta, 'code' | 'type'> | Pick<LuckOpening, 'setCode'>,
  mode: LuckScoreMode,
): Record<string, number> {
  const code = 'code' in setOrOpening ? setOrOpening.code : setOrOpening.setCode;
  const type = 'type' in setOrOpening ? setOrOpening.type : undefined;

  if (isStarterSet(code)) {
    // 스타트 덱 100: 대표 SR/SAR/MUR을 힛으로 본다.
    return { UR: getScoreWeight('UR', mode), SAR: 2, SR: getScoreWeight('SR', mode) };
  }

  if (code.startsWith('s') && !code.startsWith('sv') && type !== 'hi-class') {
    return {
      CSR: getScoreWeight('CSR', mode),
      SR: getScoreWeight('SR', mode),
      HR: getScoreWeight('HR', mode),
      SAR: 2,
      UR: 3,
      GRA: 3,
    };
  }

  if (isMegaExpansionSet(code)) {
    return {
      SAR: 2,
      UR: 3,
      MA: getScoreWeight('MA', mode),
      SR: getScoreWeight('SR', mode),
    };
  }

  if (isSv11SpecialSet(code)) {
    return {
      SR: getScoreWeight('SR', mode),
      SAR: 2,
      BWR: 3,
    };
  }

  if (type === 'hi-class') {
    return {
      CSR: getScoreWeight('CSR', mode),
      SSR: getScoreWeight('SSR', mode),
      SR: getScoreWeight('SR', mode),
      SAR: 2,
      UR: 3,
      GRA: 3,
      MA: getScoreWeight('MA', mode),
    };
  }

  return {
    SR: getScoreWeight('SR', mode),
    SAR: 2,
    UR: 3,
    BWR: 3,
  };
}

function getScoredCountKey(rarity: string, opening: LuckOpening): string {
  if (rarity === 'UR' && (isMegaExpansionSet(opening.setCode) || isStarterSet(opening.setCode))) return 'MUR';
  return rarity;
}

function getScoredRarityCounts(
  rarityCounts: Record<string, number>,
  opening: LuckOpening,
  weights: Record<string, number>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rarity of Object.keys(weights)) {
    const count = rarityCounts[rarity] ?? 0;
    if (count > 0) counts[getScoredCountKey(rarity, opening)] = count;
  }
  return counts;
}

function addExpectedCount(counts: Record<string, number>, key: string, value: number): void {
  if (value <= 0) return;
  counts[key] = (counts[key] ?? 0) + value;
}

function addExpectedCountsFromWeights(
  counts: Record<string, number>,
  weights: Record<string, number>,
  unitCount: number,
  rate = 1,
  opening?: LuckOpening,
): void {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0 || unitCount <= 0 || rate <= 0) return;

  for (const [key, weight] of Object.entries(weights)) {
    if (key === 'NONE' || weight <= 0) continue;
    const rarity =
      key.startsWith('SR') ? 'SR'
      : key.startsWith('HR') ? 'HR'
      : key;
    const countKey = opening ? getScoredCountKey(rarity, opening) : rarity;
    addExpectedCount(counts, countKey, unitCount * rate * (weight / total));
  }
}

function getExpectedScoredRarityCounts(
  opening: LuckOpening,
  set?: Pick<SetMeta, 'code' | 'type'>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const unitCount = opening.boxes + opening.packs / opening.boxSize;
  const loosePackUnitCount = opening.packs / opening.boxSize;
  const code = set?.code ?? opening.setCode;
  const addLoosePackBaselineCount = (rarity: string, perBox = 1) => {
    addExpectedCount(counts, getScoredCountKey(rarity, opening), loosePackUnitCount * perBox);
  };

  if (unitCount <= 0) return counts;

  if (isStarterSet(code)) {
    addExpectedCount(counts, getScoredCountKey('UR', opening), unitCount * STARTER_UR_RATE);
    addExpectedCount(counts, 'SAR', unitCount * STARTER_SAR_RATE);
    addExpectedCount(counts, 'SR', unitCount * STARTER_SR_RATE);
    return counts;
  }

  if (set?.type === 'hi-class') {
    if (code === 'sv8a-terastal-festa') {
      addLoosePackBaselineCount('SAR');
      addExpectedCountsFromWeights(counts, TERASTAL_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      return counts;
    }

    if (code === 'sv4a-shiny-treasure-ex') {
      addLoosePackBaselineCount('SSR');
      addExpectedCountsFromWeights(counts, SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      return counts;
    }

    if (code === 's12a-vstar-universe') {
      addLoosePackBaselineCount('SAR');
      addLoosePackBaselineCount('SR');
      addExpectedCountsFromWeights(counts, VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      addExpectedCount(counts, 'SAR', unitCount * VSTAR_UNIVERSE_SAR_GOD_PACK_RATE * 5);
      return counts;
    }

    if (code === 's8b-vmax-climax') {
      addLoosePackBaselineCount('CSR');
      addExpectedCountsFromWeights(counts, VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      addExpectedCount(counts, 'SR', unitCount * VMAX_CLIMAX_SR_GOD_PACK_RATE * 9);
      addExpectedCount(counts, 'CSR', unitCount * VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE * 4);
      return counts;
    }

    addLoosePackBaselineCount('SR');
    addLoosePackBaselineCount('MA');
    addExpectedCountsFromWeights(counts, MEGA_DREAM_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
    addExpectedCount(counts, 'MA', unitCount * HI_CLASS_GOD_PACK_RATE * 5);
    addExpectedCount(counts, 'SAR', unitCount * HI_CLASS_GOD_PACK_RATE * 4);
    return counts;
  }

  if (isMegaExpansionSet(code)) {
    addLoosePackBaselineCount('SR');
    addExpectedCountsFromWeights(
      counts,
      EXPANSION_MONSTER_WEIGHTS[code] ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT,
      unitCount,
      1,
      opening,
    );
    addExpectedCount(counts, 'SR', unitCount * MEGA_EXTRA_SR_RATE);
    return counts;
  }

  if (isSv11SpecialSet(code)) {
    addLoosePackBaselineCount('SR');
    addExpectedCountsFromWeights(counts, SV11_OPTIONAL_TOP_WEIGHTS, unitCount, 1, opening);
    addExpectedCount(counts, 'SR', unitCount * SV11_EXTRA_SR_RATE);
    return counts;
  }

  const standardRate = getStandardSvSetRate(code);
  if (standardRate) {
    addExpectedCountsFromWeights(counts, standardRate.mandatoryHighWeights, unitCount, 1, opening);
    addExpectedCountsFromWeights(counts, standardRate.extraHighWeights, unitCount, standardRate.extraHighRate, opening);
    return counts;
  }

  addExpectedCountsFromWeights(counts, DEFAULT_STANDARD_SV_HIGH_WEIGHTS, unitCount, 1, opening);
  addExpectedCountsFromWeights(counts, DEFAULT_STANDARD_EXTRA_HIGH_WEIGHTS, unitCount, DEFAULT_STANDARD_EXTRA_HIGH_RATE, opening);
  return counts;
}

function getObservedScore(
  rarityCounts: Record<string, number>,
  weights: Record<string, number>,
): number {
  return Object.entries(weights).reduce(
    (score, [rarity, weight]) => score + (rarityCounts[rarity] ?? 0) * weight,
    0,
  );
}

function subtractBaselineCounts(
  rarityCounts: Record<string, number>,
  opening: LuckOpening,
  set?: Pick<SetMeta, 'code' | 'type'>,
): Record<string, number> {
  const counts = { ...rarityCounts };
  const code = set?.code ?? opening.setCode;
  const isHiClassSet =
    set?.type === 'hi-class'
    || ['sv8a-terastal-festa', 'sv4a-shiny-treasure-ex', 's12a-vstar-universe', 's8b-vmax-climax', 'm-dream-ex'].includes(code);
  if (isHiClassSet && ['sv8a-terastal-festa', 's12a-vstar-universe'].includes(code)) {
    counts.SAR = Math.max(0, (counts.SAR ?? 0) - opening.boxes);
  }
  if (code === 'sv4a-shiny-treasure-ex') {
    counts.SSR = Math.max(0, (counts.SSR ?? 0) - opening.boxes);
  }
  if (code === 's12a-vstar-universe') {
    counts.SR = Math.max(0, (counts.SR ?? 0) - opening.boxes);
  }
  if (code === 's8b-vmax-climax') {
    counts.CSR = Math.max(0, (counts.CSR ?? 0) - opening.boxes);
  }
  if (isMegaExpansionSet(code)) {
    counts.SR = Math.max(0, (counts.SR ?? 0) - opening.boxes);
    if (isHiClassSet) {
      counts.MA = Math.max(0, (counts.MA ?? 0) - opening.boxes);
    }
  }
  if (isSv11SpecialSet(code)) {
    counts.SR = Math.max(0, (counts.SR ?? 0) - opening.boxes);
  }
  return counts;
}

function getRarityCounts(cards: Card[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((counts, card) => {
    if (card.rarity) counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
    return counts;
  }, {});
}

function estimateOldHighSlotScorePerBox(
  set: Pick<SetMeta, 'cards'>,
  weights: Record<string, number>,
): number | null {
  const highCounts = OLD_HIGH_RARITIES.reduce<Record<string, number>>((counts, rarity) => {
    const count = set.cards.filter((card) => card.rarity === rarity).length;
    if (count > 0) counts[rarity] = count;
    return counts;
  }, {});
  const total = Object.values(highCounts).reduce((sum, count) => sum + count, 0);
  if (total <= 0) return null;

  return Object.entries(highCounts).reduce(
    (score, [rarity, count]) => score + ((weights[rarity] ?? 0) * count) / total,
    0,
  );
}

function estimateExpectedScorePerBox(
  opening: LuckOpening,
  weights: Record<string, number>,
  set?: Pick<SetMeta, 'code' | 'type' | 'cards'>,
): number {
  if (set?.code.startsWith('s') && !set.code.startsWith('sv') && set.type !== 'hi-class') {
    return estimateOldHighSlotScorePerBox(set, weights) ?? opening.sarPerBox + opening.topPerBox * TOP_RARITY_WEIGHT;
  }

  return opening.sarPerBox * (weights.SAR ?? 0)
    + opening.topPerBox * ((weights.BWR ?? 0) || (weights.UR ?? 0) || TOP_RARITY_WEIGHT);
}

function scoreFromRarityWeightKey(key: string, mode: LuckScoreMode): number {
  if (key.startsWith('SR')) return getScoreWeight('SR', mode);
  if (key === 'CSR') return getScoreWeight('CSR', mode);
  if (key === 'SSR') return getScoreWeight('SSR', mode);
  if (key === 'MA') return getScoreWeight('MA', mode);
  if (key === 'CSR') return getScoreWeight('CSR', mode);
  if (key.startsWith('HR')) return getScoreWeight('HR', mode);
  if (key === 'SAR') return getScoreWeight('SAR', mode);
  if (key === 'UR' || key === 'GRA' || key === 'BWR') return getScoreWeight(key, mode);
  return 0;
}

function distributionFromWeights(
  weights: Record<string, number>,
  mode: LuckScoreMode,
): LuckScoreOutcome[] {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [{ score: 0, probability: 1 }];
  return normalizeDistribution(
    Object.entries(weights).map(([rarity, weight]) => ({
      score: scoreFromRarityWeightKey(rarity, mode),
      probability: weight / total,
    })),
  );
}

function optionalDistributionFromWeights(
  weights: Record<string, number>,
  probability: number,
  mode: LuckScoreMode,
): LuckScoreOutcome[] {
  const weightedDistribution = distributionFromWeights(weights, mode);
  return normalizeDistribution([
    { score: 0, probability: 1 - probability },
    ...weightedDistribution.map((outcome) => ({
      score: outcome.score,
      probability: outcome.probability * probability,
    })),
  ]);
}

function weightedSlotDistribution(
  weights: Record<string, number>,
  probability: number,
  mode: LuckScoreMode,
): LuckScoreOutcome[] {
  return optionalDistributionFromWeights(weights, probability, mode);
}

function optionalPackDistributionFromBoxWeights(
  weights: Record<string, number>,
  boxSize: number,
  mode: LuckScoreMode,
): LuckScoreOutcome[] {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const packWeights: Record<string, number> = {
    NONE: total * Math.max(0, boxSize - 1) + (weights.NONE ?? 0),
  };

  for (const [rarity, weight] of Object.entries(weights)) {
    if (rarity !== 'NONE') packWeights[rarity] = weight;
  }

  return distributionFromWeights(packWeights, mode);
}

function bernoulliDistribution(score: number, probability: number): LuckScoreOutcome[] {
  return normalizeDistribution([
    { score: 0, probability: 1 - probability },
    { score, probability },
  ]);
}

function getStarterScoreDistribution(mode: LuckScoreMode): LuckScoreOutcome[] {
  const zeroScoreRate = 1 - STARTER_GOLD_DECK_RATE - STARTER_SR_RATE - STARTER_STANDARD_SAR_RATE - STARTER_SPECIAL_DECK_RATE;
  return normalizeDistribution([
    { score: 0, probability: zeroScoreRate },
    { score: getScoreWeight('UR', mode), probability: STARTER_GOLD_DECK_RATE },
    { score: getScoreWeight('SR', mode), probability: STARTER_SR_RATE },
    { score: getScoreWeight('SAR', mode), probability: STARTER_STANDARD_SAR_RATE },
    { score: getScoreWeight('SAR', mode) * STARTER_SPECIAL_SAR_COUNT, probability: STARTER_SPECIAL_DECK_RATE },
  ]);
}

function getBoxScoreDistribution(
  set: Pick<SetMeta, 'code' | 'type'> | undefined,
): LuckScoreOutcome[] {
  const code = set?.code;

  if (code && isStarterSet(code)) {
    return getStarterScoreDistribution('box');
  }

  if (set?.type === 'hi-class') {
    if (code === 'sv8a-terastal-festa') {
      return distributionFromWeights(TERASTAL_EXTRA_SLOT_WEIGHTS, 'box');
    }

    if (code === 'sv4a-shiny-treasure-ex') {
      return distributionFromWeights(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'box');
    }

    if (code === 's12a-vstar-universe') {
      return convolveDistributions(
        distributionFromWeights(VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, 'box'),
        normalizeDistribution([
          { score: getScoreWeight('SAR', 'box') * 5, probability: VSTAR_UNIVERSE_SAR_GOD_PACK_RATE },
          { score: 0, probability: VSTAR_UNIVERSE_AR_GOD_PACK_RATE },
          { score: 0, probability: 1 - VSTAR_UNIVERSE_SAR_GOD_PACK_RATE - VSTAR_UNIVERSE_AR_GOD_PACK_RATE },
        ]),
      );
    }

    if (code === 's8b-vmax-climax') {
      return convolveDistributions(
        convolveDistributions(
          distributionFromWeights(VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS, 'box'),
          bernoulliDistribution(getScoreWeight('SR', 'box') * 9, VMAX_CLIMAX_SR_GOD_PACK_RATE),
        ),
        bernoulliDistribution(getScoreWeight('CSR', 'box') * 4, VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE),
      );
    }

    return convolveDistributions(
      distributionFromWeights(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, 'box'),
      bernoulliDistribution(
        getScoreWeight('MA', 'box') * 5 + getScoreWeight('SAR', 'box') * 4,
        HI_CLASS_GOD_PACK_RATE,
      ),
    );
  }

  if (code && isMegaExpansionSet(code)) {
    return convolveDistributions(
      distributionFromWeights(EXPANSION_MONSTER_WEIGHTS[code] ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT, 'box'),
      bernoulliDistribution(getScoreWeight('SR', 'box'), MEGA_EXTRA_SR_RATE),
    );
  }

  if (code && isSv11SpecialSet(code)) {
    return convolveDistributions(
      distributionFromWeights(SV11_OPTIONAL_TOP_WEIGHTS, 'box'),
      bernoulliDistribution(getScoreWeight('SR', 'box'), SV11_EXTRA_SR_RATE),
    );
  }

  const standardRate = getStandardSvSetRate(code);
  if (standardRate) {
    return convolveDistributions(
      distributionFromWeights(standardRate.mandatoryHighWeights as Record<string, number>, 'box'),
      optionalDistributionFromWeights(
        standardRate.extraHighWeights as Record<string, number>,
        standardRate.extraHighRate,
        'box',
      ),
    );
  }

  return convolveDistributions(
    distributionFromWeights(DEFAULT_STANDARD_SV_HIGH_WEIGHTS, 'box'),
    optionalDistributionFromWeights(DEFAULT_STANDARD_EXTRA_HIGH_WEIGHTS, DEFAULT_STANDARD_EXTRA_HIGH_RATE, 'box'),
  );
}

function getPackScoreDistribution(
  set: Pick<SetMeta, 'code' | 'type'> | undefined,
  boxSize: number,
): LuckScoreOutcome[] {
  const code = set?.code;
  let distribution: LuckScoreOutcome[] = [{ score: 0, probability: 1 }];

  if (code && isStarterSet(code)) {
    // 한 번 뽑기 = starter deck 1개.
    return getStarterScoreDistribution('pack');
  }

  if (set?.type === 'hi-class') {
    if (code === 'sv8a-terastal-festa') {
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('SAR', 'pack'), 1 / boxSize),
      );
      return convolveDistributions(
        distribution,
        optionalPackDistributionFromBoxWeights(TERASTAL_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
      );
    }

    if (code === 'sv4a-shiny-treasure-ex') {
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('SSR', 'pack'), 1 / boxSize),
      );
      return convolveDistributions(
        distribution,
        optionalPackDistributionFromBoxWeights(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
      );
    }

    if (code === 's12a-vstar-universe') {
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('SAR', 'pack'), 1 / boxSize),
      );
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('SR', 'pack'), 1 / boxSize),
      );
      distribution = convolveDistributions(
        distribution,
        optionalPackDistributionFromBoxWeights(VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
      );
      return convolveDistributions(
        distribution,
        normalizeDistribution([
          { score: getScoreWeight('SAR', 'pack') * 5, probability: VSTAR_UNIVERSE_SAR_GOD_PACK_RATE / boxSize },
          { score: 0, probability: VSTAR_UNIVERSE_AR_GOD_PACK_RATE / boxSize },
          { score: 0, probability: 1 - (VSTAR_UNIVERSE_SAR_GOD_PACK_RATE + VSTAR_UNIVERSE_AR_GOD_PACK_RATE) / boxSize },
        ]),
      );
    }

    if (code === 's8b-vmax-climax') {
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('CSR', 'pack'), 1 / boxSize),
      );
      distribution = convolveDistributions(
        distribution,
        optionalPackDistributionFromBoxWeights(VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
      );
      return convolveDistributions(
        distribution,
        normalizeDistribution([
          { score: getScoreWeight('SR', 'pack') * 9, probability: VMAX_CLIMAX_SR_GOD_PACK_RATE / boxSize },
          { score: getScoreWeight('CSR', 'pack') * 5, probability: VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE / boxSize },
          { score: 0, probability: 1 - (VMAX_CLIMAX_SR_GOD_PACK_RATE + VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE) / boxSize },
        ]),
      );
    }

    distribution = convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('SR', 'pack'), 1 / boxSize),
    );
    distribution = convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('MA', 'pack'), 1 / boxSize),
    );
    distribution = convolveDistributions(
      distribution,
      optionalPackDistributionFromBoxWeights(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
    );
    return convolveDistributions(
      distribution,
      bernoulliDistribution(
        getScoreWeight('MA', 'pack') * 5 + getScoreWeight('SAR', 'pack') * 4,
        HI_CLASS_GOD_PACK_RATE / boxSize,
      ),
    );
  }

  if (code && isMegaExpansionSet(code)) {
    distribution = convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('SR', 'pack'), 1 / boxSize),
    );
    distribution = convolveDistributions(
      distribution,
      weightedSlotDistribution(EXPANSION_MONSTER_WEIGHTS[code] ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT, 1 / boxSize, 'pack'),
    );
    return convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('SR', 'pack'), MEGA_EXTRA_SR_RATE / boxSize),
    );
  }

  if (code && isSv11SpecialSet(code)) {
    distribution = convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('SR', 'pack'), 1 / boxSize),
    );
    distribution = convolveDistributions(
      distribution,
      optionalPackDistributionFromBoxWeights(SV11_OPTIONAL_TOP_WEIGHTS, boxSize, 'pack'),
    );
    return convolveDistributions(
      distribution,
      bernoulliDistribution(getScoreWeight('SR', 'pack'), SV11_EXTRA_SR_RATE / boxSize),
    );
  }

  const standardRate = getStandardSvSetRate(code);
  if (standardRate) {
    distribution = convolveDistributions(
      distribution,
      weightedSlotDistribution(standardRate.mandatoryHighWeights as Record<string, number>, 1 / boxSize, 'pack'),
    );
    return convolveDistributions(
      distribution,
      weightedSlotDistribution(
        standardRate.extraHighWeights as Record<string, number>,
        standardRate.extraHighRate / boxSize,
        'pack',
      ),
    );
  }

  distribution = convolveDistributions(
    distribution,
    weightedSlotDistribution(DEFAULT_STANDARD_SV_HIGH_WEIGHTS, 1 / boxSize, 'pack'),
  );
  return convolveDistributions(
    distribution,
    weightedSlotDistribution(DEFAULT_STANDARD_EXTRA_HIGH_WEIGHTS, DEFAULT_STANDARD_EXTRA_HIGH_RATE / boxSize, 'pack'),
  );
}

function getScoreDistributionForOpening(
  opening: LuckOpening,
  set?: Pick<SetMeta, 'code' | 'type'>,
): LuckScoreOutcome[] {
  const boxDistribution = getBoxScoreDistribution(set);
  const packDistribution = getPackScoreDistribution(set, opening.boxSize);
  const boxCount = Math.max(0, Math.floor(opening.boxes));
  const loosePackCount = Math.max(0, opening.packs);
  return convolveDistributions(
    repeatDistribution(boxDistribution, boxCount),
    repeatDistribution(packDistribution, loosePackCount),
  );
}

export function summarizeLuckRarityCounts(
  rarityCounts: Record<string, number>,
  opening: LuckOpening,
  set?: Pick<SetMeta, 'code' | 'type' | 'cards'>,
): LuckEventSummary {
  const packEquivalent = opening.boxes * opening.boxSize + opening.packs;
  const treatsUrAsTop = isMegaExpansionSet(opening.setCode) || isStarterSet(opening.setCode) || opening.setCode === 's12a-vstar-universe';
  const scoreMode: LuckScoreMode = opening.boxes > 0 ? 'box' : 'pack';
  const weights = getLuckScoreWeightsForSet(set ?? opening, scoreMode);
  const adjustedCounts = subtractBaselineCounts(rarityCounts, opening, set);
  const expectedScorePerBox = estimateExpectedScorePerBox(opening, weights, set);
  const scoreDistribution = getScoreDistributionForOpening(opening, set);
  const observedScore = getObservedScore(adjustedCounts, weights);
  const scoreCounts = getScoredRarityCounts(adjustedCounts, opening, weights);

  return {
    topCount:
      (rarityCounts.BWR ?? 0)
      + (rarityCounts.MUR ?? 0)
      + (rarityCounts.GRA ?? 0)
      + (treatsUrAsTop ? rarityCounts.UR ?? 0 : 0),
    sarCount: rarityCounts.SAR ?? 0,
    topExpected: (opening.topPerBox / opening.boxSize) * packEquivalent,
    sarExpected: (opening.sarPerBox / opening.boxSize) * packEquivalent,
    observedScore,
    expectedScore: scoreDistribution ? distributionExpectedScore(scoreDistribution) : (expectedScorePerBox / opening.boxSize) * packEquivalent,
    scoreCounts,
    expectedScoreCounts: getExpectedScoredRarityCounts(opening, set),
    scoreDistribution,
    openingUnits: opening.boxes + opening.packs / opening.boxSize,
  };
}

export function summarizeWeightedLuckEvent(
  cards: Card[],
  opening: LuckOpening,
  set?: Pick<SetMeta, 'code' | 'type' | 'cards'>,
): WeightedLuckScore | null {
  return scoreLuckSummary(summarizeLuckRarityCounts(getRarityCounts(cards), opening, set));
}

const DEFAULT_STANDARD_SV_HIGH_WEIGHTS = {
  SR_POKEMON: 48.125,
  SR_TRAINER: 21.875,
  SAR: 20,
  UR: 10,
};
const DEFAULT_STANDARD_EXTRA_HIGH_RATE = 0.1;
const DEFAULT_STANDARD_EXTRA_HIGH_WEIGHTS = {
  SR_POKEMON: 68.75,
  SR_TRAINER: 31.25,
};

export function getLuckRatesForSet(
  set: Pick<SetMeta, 'code' | 'type' | 'box_size'>,
): Pick<LuckOpening, 'boxSize' | 'topPerBox' | 'sarPerBox'> {
  const boxSize = Math.max(1, set.box_size || DEFAULT_BOX_SIZE);

  if (isStarterSet(set.code)) {
    return { boxSize, topPerBox: STARTER_UR_RATE, sarPerBox: STARTER_SAR_RATE };
  }

  if (set.type === 'hi-class') {
    if (set.code === 'sv8a-terastal-festa') {
      return {
        boxSize,
        topPerBox: 0,
        sarPerBox: 1 + weightChance(TERASTAL_EXTRA_SLOT_WEIGHTS, 'SAR'),
      };
    }

    if (set.code === 'sv4a-shiny-treasure-ex') {
      return {
        boxSize,
        topPerBox:
          weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'UR')
          + weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'SSR'),
        sarPerBox: 1 + weightChance(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'SAR'),
      };
    }

    if (set.code === 's12a-vstar-universe') {
      return {
        boxSize,
        topPerBox: weightChance(VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, 'UR'),
        sarPerBox:
          1
          + weightChance(VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, 'SAR')
          + VSTAR_UNIVERSE_SAR_GOD_PACK_RATE * 5,
      };
    }

    if (set.code === 's8b-vmax-climax') {
      return {
        boxSize,
        topPerBox: weightChance(VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS, 'GRA'),
        sarPerBox: 0,
      };
    }

    return {
      boxSize,
      topPerBox: isMegaExpansionSet(set.code) ? weightChance(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, 'UR') : 0,
      sarPerBox: weightChance(MEGA_DREAM_EXTRA_SLOT_WEIGHTS, 'SAR') + HI_CLASS_GOD_PACK_RATE * 4,
    };
  }

  if (isMegaExpansionSet(set.code)) {
    const pokemonHighWeights = EXPANSION_MONSTER_WEIGHTS[set.code] ?? EXPANSION_MONSTER_WEIGHTS_DEFAULT;

    return {
      boxSize,
      topPerBox: weightChance(pokemonHighWeights, 'UR'),
      sarPerBox: weightChance(pokemonHighWeights, 'SAR'),
    };
  }

  if (isSv11SpecialSet(set.code)) {
    return {
      boxSize,
      topPerBox: weightChance(SV11_OPTIONAL_TOP_WEIGHTS, 'BWR'),
      sarPerBox: weightChance(SV11_OPTIONAL_TOP_WEIGHTS, 'SAR'),
    };
  }

  const standardRate = getStandardSvSetRate(set.code);
  if (standardRate) {
    return {
      boxSize,
      topPerBox: 0,
      sarPerBox: weightChance(standardRate.mandatoryHighWeights, 'SAR'),
    };
  }

  return {
    boxSize,
    topPerBox: 0,
    sarPerBox: weightChance(DEFAULT_STANDARD_SV_HIGH_WEIGHTS, 'SAR'),
  };
}

export function createLuckOpening(
  set: Pick<SetMeta, 'code' | 'type' | 'box_size'>,
  counts: { boxes?: number; packs?: number },
): LuckOpening {
  const rates = getLuckRatesForSet(set);

  return {
    setCode: set.code,
    boxes: counts.boxes ?? 0,
    packs: counts.packs ?? 0,
    ...rates,
  };
}

export function summarizeLuckEvent(cards: Card[], opening: LuckOpening): LuckEventSummary {
  const packEquivalent = opening.boxes * opening.boxSize + opening.packs;

  return {
    topCount: cards.filter((card) =>
      card.rarity === 'BWR'
      || card.rarity === 'GRA'
      || (card.rarity === 'UR' && (isMegaContext(card) || opening.setCode === 's12a-vstar-universe')),
    ).length,
    sarCount: cards.filter((card) => card.rarity === 'SAR').length,
    topExpected: (opening.topPerBox / opening.boxSize) * packEquivalent,
    sarExpected: (opening.sarPerBox / opening.boxSize) * packEquivalent,
  };
}
