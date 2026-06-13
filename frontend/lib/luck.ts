import type { Card, SetMeta } from './types';
import {
  estimateReferenceValueFromCounts,
  getDistributionValueLuckScore,
  getObservedReferenceValueKrw,
  getObservedReferenceValueSource,
  getReferenceValueRatio,
} from './valueLuck';
import type { ReferenceValueSource, ValueLuckMode } from './valueLuck';
import {
  ANNIVERSARY_25_BOX_SIZE,
  ANNIVERSARY_25_HIT_WEIGHTS,
  ANNIVERSARY_25_LUCK_SCORE_WEIGHTS,
  ANNIVERSARY_25_PROMO_INTERVAL,
  EXPANSION_MONSTER_WEIGHTS,
  EXPANSION_MONSTER_WEIGHTS_DEFAULT,
  HI_CLASS_GOD_PACK_RATE,
  hasAceSpecSlot,
  MEGA_AR_COUNT,
  MEGA_DREAM_EXTRA_SLOT_WEIGHTS,
  MEGA_EXTRA_SR_RATE,
  SHINY_STAR_V_EXTRA_SLOT_WEIGHTS,
  SHINY_TREASURE_EXTRA_SLOT_WEIGHTS,
  SV11_AR_COUNT,
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
  isAnniversary25Set,
  isMegaExpansionSet,
  isStarterSet,
  isSv11SpecialSet,
  STARTER_AR_RATE,
  STARTER_SR_RATE,
  STARTER_STANDARD_SAR_RATE,
  STARTER_UR_RATE,
  ALT_SR_NUMBER_RANGES,
} from './simulation/model';
import type { StandardSvSetRate } from './simulation/types';

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
  observedValueKrw?: number;
  expectedValueKrw?: number;
  valueRatio?: number | null;
  valueSource?: ReferenceValueSource;
  valuePercentile?: number | null;
  valueTierScore?: number | null;
  valueScoreWeight?: number;
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
  observedValueKrw?: number;
  expectedValueKrw?: number;
  valueRatio?: number | null;
  valueSource?: ReferenceValueSource;
  valuePercentile?: number | null;
  valueTierScore?: number | null;
  valueScoreWeight?: number;
}

export type LuckBand = 'lucky' | 'average' | 'unlucky';

const TOP_RARITY_WEIGHT = 3;
const OLD_HIGH_RARITIES = ['A', 'SR_ALT', 'SR', 'CSR', 'HR', 'SAR', 'UR', 'UR_LOW', 'GRA'] as const;
const SCORE_EPSILON = 1e-9;
const SCORE_WEIGHTS: Record<string, number> = {
  S: 0.08,
  A: 0.5,
  SSR: 0.5,
  SR_ALT: 1.2,
  SR: 0.5,
  CSR: 1,
  MA: 0.5,
  HR: 1,
  SAR: 2,
  UR: 3,
  UR_LOW: 0,
  GRA: 3,
  BWR: 3,
};
const PACK_SCORE_WEIGHTS: Record<string, number> = {
  S: 0.25,
  A: 1,
  SR: 1,
  SR_ALT: 2,
  CSR: 2,
  SSR: 1,
  MA: 1,
  HR: 2,
  SAR: 2,
  UR: 3,
  UR_LOW: 0,
  GRA: 3,
  BWR: 3,
};
const LUCK_COMBINATION_RULES = {
  primaryHitKeys: ['MUR', 'BWR', 'UR', 'GRA', 'SAR', 'HR', 'SR_ALT'],
  secondaryHitKeys: ['MA', 'SSR', 'CSR', 'SR', 'A'],
  rarityMultiplier: {
    MUR: 1.2,
    BWR: 1.2,
    UR: 0.95,
    GRA: 0.95,
    SAR: 1,
    HR: 0.75,
    SR_ALT: 0.55,
    CSR: 0.4,
    A: 0.25,
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
type LuckSetContext = Pick<SetMeta, 'code' | 'type' | 'cards' | 'luck_value_ref'>;
type LuckUrContext = Pick<SetMeta, 'code'> & Partial<Pick<SetMeta, 'cards'>>;

function getScoreWeight(rarity: string, mode: LuckScoreMode): number {
  return (mode === 'pack' ? PACK_SCORE_WEIGHTS : SCORE_WEIGHTS)[rarity] ?? 0;
}

function isInRanges(number: number, ranges: Array<[number, number]> | undefined): boolean {
  return Boolean(ranges?.some(([start, end]) => number >= start && number <= end));
}

function isLowScoreUrCard(card: Card, setCode?: string): boolean {
  return isLowScoreUrSet(setCode)
    && card.rarity === 'UR'
    && card.card_type !== '포켓몬';
}

function getLuckCountKeyForCard(card: Card, setCode?: string): string | null {
  if (!card.rarity) return null;
  if (isLowScoreUrCard(card, setCode)) return 'UR_LOW';
  if (
    card.rarity === 'SR'
    && card.card_type === '포켓몬'
    && setCode
    && isInRanges(card.number, ALT_SR_NUMBER_RANGES[setCode])
  ) {
    return 'SR_ALT';
  }
  return card.rarity;
}

function getLuckAdjustedHighWeights(
  weights: Partial<Record<string, number>>,
  set?: LuckUrContext,
): Record<string, number> {
  const adjusted: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value === 'number') adjusted[key] = value;
  }

  const urSplit = getUrScoreSplit(set);
  if (urSplit && adjusted.UR && adjusted.UR > 0) {
    const urWeight = adjusted.UR;
    adjusted.UR = urWeight * urSplit.top;
    adjusted.UR_LOW = urWeight * urSplit.low;
  }
  return adjusted;
}

function isLowScoreUrSet(setCode?: string): boolean {
  return Boolean(
    setCode
      && !isStarterSet(setCode)
      && !isMegaExpansionSet(setCode)
      && !isAnniversary25Set(setCode),
  );
}

function getUrScoreSplit(set?: LuckUrContext): { top: number; low: number } | null {
  if (!isLowScoreUrSet(set?.code)) return null;

  const urCards = set?.cards?.filter((card) => card.rarity === 'UR') ?? [];
  if (urCards.length === 0) return null;

  const top = urCards.filter((card) => card.card_type === '포켓몬').length / urCards.length;
  return { top, low: 1 - top };
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

function getValueLuckTierScore(valueRatio: number | null | undefined): number | null {
  if (valueRatio === null || valueRatio === undefined || !Number.isFinite(valueRatio)) return null;
  if (valueRatio <= 0) return -4;
  return Math.max(-4, Math.min(4, Math.log2(valueRatio)));
}

function mergeValueSource(
  left: LuckEventSummary['valueSource'],
  right: LuckEventSummary['valueSource'],
): LuckEventSummary['valueSource'] {
  if (!left) return right;
  if (!right) return left;
  if (left === right) return left;
  return 'mixed';
}

export function scoreLuckSummary(summary: LuckEventSummary): WeightedLuckScore | null {
  const valueRatio = summary.valueRatio
    ?? getReferenceValueRatio(summary.observedValueKrw ?? 0, summary.expectedValueKrw ?? 0);
  const ratioValueTierScore = getValueLuckTierScore(valueRatio);
  const hasDistributionValueScore = summary.valueTierScore !== null && summary.valueTierScore !== undefined;
  const positiveRatioValueTierScore = ratioValueTierScore !== null && ratioValueTierScore > 0
    ? ratioValueTierScore
    : null;
  const valueTierScore = hasDistributionValueScore
    ? summary.valueTierScore ?? null
    : positiveRatioValueTierScore;
  const usesDistributionValueScore = hasDistributionValueScore && valueTierScore !== null;
  const observedScore = usesDistributionValueScore
    ? (summary.valuePercentile ?? valueRatio ?? 0)
    : summary.observedScore ?? summary.sarCount + summary.topCount * TOP_RARITY_WEIGHT;
  const expectedScore = usesDistributionValueScore
    ? 1
    : summary.expectedScore
      ?? (summary.scoreDistribution ? distributionExpectedScore(summary.scoreDistribution) : summary.sarExpected + summary.topExpected * TOP_RARITY_WEIGHT);
  if (expectedScore < 0) return null;

  const stdDev = summary.scoreDistribution ? distributionStdDev(summary.scoreDistribution, expectedScore) : 0;
  const luckZScore = usesDistributionValueScore
    ? valueTierScore ?? 0
    : stdDev > SCORE_EPSILON ? (observedScore - expectedScore) / stdDev : 0;
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
  const rarityTierScore = primarySurpriseScore >= LUCK_COMBINATION_RULES.primaryActivationScore ? primarySurpriseScore
      : secondaryOrBaselineScore > 0 ? secondaryOrBaselineScore
      : droughtTierScore < 0 ? droughtTierScore
      : secondaryOrBaselineScore;
  const luckTierScore = Math.max(valueTierScore ?? Number.NEGATIVE_INFINITY, rarityTierScore);
  const luckBand = getLuckBand(luckZScore);
  const isLucky = luckBand === 'lucky';

  return {
    ...summary,
    observedScore,
    expectedScore,
    valueRatio,
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
        const observedValueKrw = (total.observedValueKrw ?? 0) + (summary.observedValueKrw ?? 0);
        const expectedValueKrw = (total.expectedValueKrw ?? 0) + (summary.expectedValueKrw ?? 0);
        const totalValueWeight = total.valueScoreWeight ?? 0;
        const summaryValueWeight = summary.valueTierScore !== null && summary.valueTierScore !== undefined
          ? summary.valueScoreWeight ?? summary.openingUnits ?? 1
          : 0;
        const valueScoreWeight = totalValueWeight + summaryValueWeight;
        const valueTierScore = valueScoreWeight > 0
          ? (
              (total.valueTierScore ?? 0) * totalValueWeight
              + (summary.valueTierScore ?? 0) * summaryValueWeight
            ) / valueScoreWeight
          : undefined;
        const valuePercentile = valueScoreWeight > 0
          ? (
              (total.valuePercentile ?? 0) * totalValueWeight
              + (summary.valuePercentile ?? 0) * summaryValueWeight
            ) / valueScoreWeight
          : undefined;
        const hasValueScore = expectedValueKrw > 0 || valueScoreWeight > 0;

        return {
          topCount: total.topCount + summary.topCount,
          sarCount: total.sarCount + summary.sarCount,
          topExpected: total.topExpected + summary.topExpected,
          sarExpected: total.sarExpected + summary.sarExpected,
          observedValueKrw,
          expectedValueKrw,
          valueRatio: getReferenceValueRatio(observedValueKrw, expectedValueKrw),
          valueSource: mergeValueSource(total.valueSource, summary.valueSource),
          valuePercentile,
          valueTierScore,
          valueScoreWeight,
          observedScore: hasValueScore
            ? undefined
            : (total.observedScore ?? 0) + (summary.observedScore ?? summary.sarCount + summary.topCount * TOP_RARITY_WEIGHT),
          expectedScore: hasValueScore
            ? undefined
            : scoreDistribution
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
        observedValueKrw: 0,
        expectedValueKrw: 0,
        valueRatio: null,
        valuePercentile: null,
        valueTierScore: null,
        valueScoreWeight: 0,
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

  if (isAnniversary25Set(code)) {
    return ANNIVERSARY_25_LUCK_SCORE_WEIGHTS;
  }

  if (code.startsWith('s') && !code.startsWith('sv') && type !== 'hi-class') {
    return {
      A: getScoreWeight('A', mode),
      CSR: getScoreWeight('CSR', mode),
      SR_ALT: getScoreWeight('SR_ALT', mode),
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
      S: getScoreWeight('S', mode),
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
      key === 'SR_ALT' ? 'SR_ALT'
      : key.startsWith('SR') ? 'SR'
      : key.startsWith('HR') ? 'HR'
      : key;
    const countKey = opening ? getScoredCountKey(rarity, opening) : rarity;
    addExpectedCount(counts, countKey, unitCount * rate * (weight / total));
  }
}

function getExpectedScoredRarityCounts(
  opening: LuckOpening,
  set?: LuckSetContext,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const unitCount = opening.boxes + opening.packs / opening.boxSize;
  const loosePackUnitCount = opening.packs / opening.boxSize;
  const code = set?.code ?? opening.setCode;
  // 가치 기반 운에서는 observed가 박스 안 모든 가격 카드를 더하므로, 박스 확정 슬롯도
  // 박스당 1장(unitCount) 기준으로 기대치에 넣어야 한다. (loosePackUnitCount는 박스에서 0이라
  // 확정 SAR/CSR 등이 기대치에서 빠져 SAR이 없어도 고등급으로 뜨던 버그가 있었다.)
  void loosePackUnitCount;
  const addLoosePackBaselineCount = (rarity: string, perBox = 1) => {
    addExpectedCount(counts, getScoredCountKey(rarity, opening), unitCount * perBox);
  };

  if (unitCount <= 0) return counts;

  if (isStarterSet(code)) {
    // 가치 기반 운: 기대 가치 기준선을 '평범한 AR/SR 뽑기'로 잡는다.
    // SAR(고가)·특수덱·골드(MUR) 잭팟은 기대치에서 빼야 평범한 AR 뽑기가 mid로 나오고
    // 비싼 카드를 뽑았을 때만 서프라이즈로 등급이 올라간다.
    addExpectedCount(counts, 'AR', unitCount * STARTER_AR_RATE);
    addExpectedCount(counts, 'SR', unitCount * STARTER_SR_RATE);
    return counts;
  }

  if (isAnniversary25Set(code)) {
    addExpectedCount(counts, '25TH', unitCount * opening.boxSize);
    addExpectedCount(counts, 'S8AP', (unitCount * opening.boxSize) / ANNIVERSARY_25_PROMO_INTERVAL);
    addExpectedCountsFromWeights(counts, ANNIVERSARY_25_HIT_WEIGHTS, unitCount * opening.boxSize * 4, 1, opening);
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

    if (code === 's4a-shiny-star-v') {
      addExpectedCount(counts, 'S', unitCount * 3);
      addLoosePackBaselineCount('SSR');
      addExpectedCountsFromWeights(counts, SHINY_STAR_V_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      return counts;
    }

    if (code === 's12a-vstar-universe') {
      addLoosePackBaselineCount('SAR');
      addLoosePackBaselineCount('SR');
      addExpectedCount(counts, 'K', unitCount);       // 확정 K 1장
      addExpectedCount(counts, 'AR', unitCount * 3);   // 확정 AR 3장
      addExpectedCountsFromWeights(counts, VSTAR_UNIVERSE_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      addExpectedCount(counts, 'SAR', unitCount * VSTAR_UNIVERSE_SAR_GOD_PACK_RATE * 5);
      return counts;
    }

    if (code === 's8b-vmax-climax') {
      addLoosePackBaselineCount('CSR');
      addExpectedCount(counts, 'CHR', unitCount * 3.5); // 확정 CHR 3~4장
      addExpectedCountsFromWeights(counts, VMAX_CLIMAX_EXTRA_SLOT_WEIGHTS, unitCount, 1, opening);
      addExpectedCount(counts, 'SR', unitCount * VMAX_CLIMAX_SR_GOD_PACK_RATE * 9);
      addExpectedCount(counts, 'CSR', unitCount * VMAX_CLIMAX_CHR_CSR_GOD_PACK_RATE * 4);
      return counts;
    }

    // 기본 하이클래스(MEGA 드림 ex 등): 확정 AR 3장
    addLoosePackBaselineCount('SR');
    addLoosePackBaselineCount('MA');
    addExpectedCount(counts, 'AR', unitCount * 3);
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
    addExpectedCount(counts, 'AR', unitCount * MEGA_AR_COUNT);
    return counts;
  }

  if (isSv11SpecialSet(code)) {
    addLoosePackBaselineCount('SR');
    addExpectedCountsFromWeights(counts, SV11_OPTIONAL_TOP_WEIGHTS, unitCount, 1, opening);
    addExpectedCount(counts, 'SR', unitCount * SV11_EXTRA_SR_RATE);
    addExpectedCount(counts, 'AR', unitCount * SV11_AR_COUNT);
    return counts;
  }

  const standardRate = getStandardSvSetRate(code);
  if (standardRate) {
    addExpectedCountsFromWeights(counts, getLuckAdjustedHighWeights(standardRate.mandatoryHighWeights, set ?? { code }), unitCount, 1, opening);
    addExpectedCountsFromWeights(counts, getLuckAdjustedHighWeights(standardRate.extraHighWeights, set ?? { code }), unitCount, standardRate.extraHighRate, opening);
    addStandardFixedSlotCounts(counts, standardRate, unitCount, code);
    return counts;
  }

  addExpectedCountsFromWeights(counts, DEFAULT_STANDARD_SV_HIGH_WEIGHTS, unitCount, 1, opening);
  addExpectedCountsFromWeights(counts, DEFAULT_STANDARD_EXTRA_HIGH_WEIGHTS, unitCount, DEFAULT_STANDARD_EXTRA_HIGH_RATE, opening);
  addExpectedCount(counts, 'AR', unitCount * 3);
  return counts;
}

/**
 * 가치 기반 운에서 observed는 박스 안의 *모든 가격 카드*를 더한다. 따라서 박스마다 확정으로
 * 들어가는 가격 슬롯(AR 3장, ACE 1장, K/CHR 등)을 기대치에도 똑같이 넣어줘야 한다.
 * 안 그러면 확정 AR 가치만큼 observed가 항상 expected를 초과해 SAR이 없어도 고등급으로 뜬다.
 */
function addStandardFixedSlotCounts(
  counts: Record<string, number>,
  rate: StandardSvSetRate,
  unitCount: number,
  code?: string,
): void {
  addExpectedCount(counts, 'AR', unitCount * (rate.arCount ?? 3));
  if (rate.kCount) addExpectedCount(counts, 'K', unitCount * rate.kCount);
  if (rate.chrCount) addExpectedCount(counts, 'CHR', unitCount * rate.chrCount);
  if (hasAceSpecSlot(code)) addExpectedCount(counts, 'ACE', unitCount);
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
  set?: LuckSetContext,
): Record<string, number> {
  const counts = { ...rarityCounts };
  const code = set?.code ?? opening.setCode;
  const isHiClassSet =
    set?.type === 'hi-class'
    || ['sv8a-terastal-festa', 'sv4a-shiny-treasure-ex', 's4a-shiny-star-v', 's12a-vstar-universe', 's8b-vmax-climax', 'm-dream-ex'].includes(code);
  if (isHiClassSet && ['sv8a-terastal-festa', 's12a-vstar-universe'].includes(code)) {
    counts.SAR = Math.max(0, (counts.SAR ?? 0) - opening.boxes);
  }
  if (code === 'sv4a-shiny-treasure-ex') {
    counts.SSR = Math.max(0, (counts.SSR ?? 0) - opening.boxes);
  }
  if (code === 's4a-shiny-star-v') {
    counts.S = Math.max(0, (counts.S ?? 0) - opening.boxes * 3);
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

function getRarityCounts(cards: Card[], setCode?: string): Record<string, number> {
  return cards.reduce<Record<string, number>>((counts, card) => {
    const key = getLuckCountKeyForCard(card, setCode);
    if (key) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function estimateOldHighSlotScorePerBox(
  set: Pick<SetMeta, 'code' | 'cards'>,
  weights: Record<string, number>,
): number | null {
  const highCounts = OLD_HIGH_RARITIES.reduce<Record<string, number>>((counts, rarity) => {
    const count = set.cards.filter((card) => getLuckCountKeyForCard(card, set.code) === rarity).length;
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
  set?: LuckSetContext,
): number {
  if (isAnniversary25Set(set?.code ?? opening.setCode)) {
    return distributionExpectedScore(getAnniversary25BoxScoreDistribution(opening.boxSize));
  }

  if (set?.code.startsWith('s') && !set.code.startsWith('sv') && set.type !== 'hi-class') {
    return estimateOldHighSlotScorePerBox(set, weights) ?? opening.sarPerBox + opening.topPerBox * TOP_RARITY_WEIGHT;
  }

  return opening.sarPerBox * (weights.SAR ?? 0)
    + opening.topPerBox * ((weights.BWR ?? 0) || (weights.UR ?? 0) || TOP_RARITY_WEIGHT);
}

function scoreFromRarityWeightKey(key: string, mode: LuckScoreMode): number {
  if (key === '25TH') return ANNIVERSARY_25_LUCK_SCORE_WEIGHTS[key] ?? 0;
  if (key === 'S8AP') return ANNIVERSARY_25_LUCK_SCORE_WEIGHTS[key] ?? 0;
  if (key === 'S') return getScoreWeight('S', mode);
  if (key === 'A') return getScoreWeight('A', mode);
  if (key === 'SR_ALT') return getScoreWeight('SR_ALT', mode);
  if (key.startsWith('SR')) return getScoreWeight('SR', mode);
  if (key === 'CSR') return getScoreWeight('CSR', mode);
  if (key === 'SSR') return getScoreWeight('SSR', mode);
  if (key === 'MA') return getScoreWeight('MA', mode);
  if (key === 'CSR') return getScoreWeight('CSR', mode);
  if (key.startsWith('HR')) return getScoreWeight('HR', mode);
  if (key === 'SAR') return getScoreWeight('SAR', mode);
  if (key === 'UR_LOW') return 0;
  if (key === 'UR' || key === 'GRA' || key === 'BWR') return getScoreWeight(key, mode);
  if (key === 'RR' || key === 'RRR') return ANNIVERSARY_25_LUCK_SCORE_WEIGHTS[key] ?? 0;
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

function getAnniversary25BoxScoreDistribution(boxSize = ANNIVERSARY_25_BOX_SIZE): LuckScoreOutcome[] {
  const hitDistribution = distributionFromWeights(ANNIVERSARY_25_HIT_WEIGHTS, 'box');
  return convolveDistributions(
    repeatDistribution(hitDistribution, Math.max(1, Math.floor(boxSize || ANNIVERSARY_25_BOX_SIZE) * 4)),
    repeatDistribution(
      [{ score: ANNIVERSARY_25_LUCK_SCORE_WEIGHTS.S8AP ?? 0, probability: 1 }],
      Math.max(1, Math.floor((boxSize || ANNIVERSARY_25_BOX_SIZE) / ANNIVERSARY_25_PROMO_INTERVAL)),
    ),
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
  // 베이스라인 = '평범한 덱' 1개(표준 SR/SAR)만. 골드(MUR)·특수덱(SAR 3장) 잭팟은
  // 여기 넣지 않는다 — 넣으면 평균이 잭팟에 끌려올라가 평범한 뽑기가 항상 '평균 이하'가 된다.
  // 잭팟은 expectedScoreCounts 대비 서프라이즈로만 점수에 반영한다.
  const zeroScoreRate = 1 - STARTER_SR_RATE - STARTER_STANDARD_SAR_RATE;
  return normalizeDistribution([
    { score: 0, probability: zeroScoreRate },
    { score: getScoreWeight('SR', mode), probability: STARTER_SR_RATE },
    { score: getScoreWeight('SAR', mode), probability: STARTER_STANDARD_SAR_RATE },
  ]);
}

function getBoxScoreDistribution(
  set: LuckSetContext | undefined,
): LuckScoreOutcome[] {
  const code = set?.code;

  if (code && isStarterSet(code)) {
    return getStarterScoreDistribution('box');
  }

  if (code && isAnniversary25Set(code)) {
    return getAnniversary25BoxScoreDistribution(ANNIVERSARY_25_BOX_SIZE);
  }

  if (set?.type === 'hi-class') {
    if (code === 'sv8a-terastal-festa') {
      return distributionFromWeights(TERASTAL_EXTRA_SLOT_WEIGHTS, 'box');
    }

    if (code === 'sv4a-shiny-treasure-ex') {
      return distributionFromWeights(SHINY_TREASURE_EXTRA_SLOT_WEIGHTS, 'box');
    }

    if (code === 's4a-shiny-star-v') {
      return distributionFromWeights(SHINY_STAR_V_EXTRA_SLOT_WEIGHTS, 'box');
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
    const mandatoryHighWeights = getLuckAdjustedHighWeights(standardRate.mandatoryHighWeights, set ?? (code ? { code } : undefined));
    const extraHighWeights = getLuckAdjustedHighWeights(standardRate.extraHighWeights, set ?? (code ? { code } : undefined));
    return convolveDistributions(
      distributionFromWeights(mandatoryHighWeights, 'box'),
      optionalDistributionFromWeights(
        extraHighWeights,
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
  set: LuckSetContext | undefined,
  boxSize: number,
): LuckScoreOutcome[] {
  const code = set?.code;
  let distribution: LuckScoreOutcome[] = [{ score: 0, probability: 1 }];

  if (code && isStarterSet(code)) {
    // 한 번 뽑기 = starter deck 1개.
    return getStarterScoreDistribution('pack');
  }

  if (code && isAnniversary25Set(code)) {
    return convolveDistributions(
      repeatDistribution(distributionFromWeights(ANNIVERSARY_25_HIT_WEIGHTS, 'pack'), 4),
      bernoulliDistribution(
        ANNIVERSARY_25_LUCK_SCORE_WEIGHTS.S8AP ?? 0,
        1 / ANNIVERSARY_25_PROMO_INTERVAL,
      ),
    );
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

    if (code === 's4a-shiny-star-v') {
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('S', 'pack'), 3 / boxSize),
      );
      distribution = convolveDistributions(
        distribution,
        bernoulliDistribution(getScoreWeight('SSR', 'pack'), 1 / boxSize),
      );
      return convolveDistributions(
        distribution,
        optionalPackDistributionFromBoxWeights(SHINY_STAR_V_EXTRA_SLOT_WEIGHTS, boxSize, 'pack'),
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
    const mandatoryHighWeights = getLuckAdjustedHighWeights(standardRate.mandatoryHighWeights, set ?? (code ? { code } : undefined));
    const extraHighWeights = getLuckAdjustedHighWeights(standardRate.extraHighWeights, set ?? (code ? { code } : undefined));
    distribution = convolveDistributions(
      distribution,
      weightedSlotDistribution(mandatoryHighWeights, 1 / boxSize, 'pack'),
    );
    return convolveDistributions(
      distribution,
      weightedSlotDistribution(
        extraHighWeights,
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
  set?: LuckSetContext,
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

function getDistributionValueMode(opening: LuckOpening): ValueLuckMode | null {
  if (opening.boxes > 0 && opening.packs === 0) return 'box';
  if (opening.boxes === 0 && opening.packs > 0) return 'pack';
  return null;
}

function getDistributionValueUnitCount(opening: LuckOpening, mode: ValueLuckMode | null): number {
  if (mode === 'box') return Math.max(1, opening.boxes);
  if (mode === 'pack') return Math.max(1, opening.packs);
  return 1;
}

/**
 * 등급 카운트를 가치 평균(getSetValueAverages) 버킷 키에 맞게 변환한다.
 * starter/MEGA는 UR이 MUR 버킷으로 저장되므로 UR→MUR로 합친다.
 */
function remapValueCountKeys(
  counts: Record<string, number>,
  setCode?: string,
): Record<string, number> {
  if (!isStarterSet(setCode) && !isMegaExpansionSet(setCode)) return counts;
  const remapped: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    const mapped = key === 'UR' ? 'MUR' : key;
    remapped[mapped] = (remapped[mapped] ?? 0) + count;
  }
  return remapped;
}

export function summarizeLuckRarityCounts(
  rarityCounts: Record<string, number>,
  opening: LuckOpening,
  set?: LuckSetContext,
  cards?: Card[],
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
  const expectedScoreCounts = getExpectedScoredRarityCounts(opening, set);
  // 스타트덱은 카드 가격 편차가 1000배라 실제 가격을 쓰면 같은 등급도 조무래기~최강자로 튄다.
  // 등급별 평균가로 매끄럽게 환산해 "AR=중간, SAR/MUR=최상위"처럼 등급 기준으로 본다.
  const observedValueKrw = cards && cards.length > 0
    ? getObservedReferenceValueKrw(cards, set)
    : isStarterSet(opening.setCode)
      ? estimateReferenceValueFromCounts(remapValueCountKeys(adjustedCounts, opening.setCode), set)
      : estimateReferenceValueFromCounts(adjustedCounts, set);
  const valueMode = getDistributionValueMode(opening);
  const useBoxEquivalentValueForMultiPack = valueMode === 'pack' && opening.packs > 1;
  const distributionValueMode = useBoxEquivalentValueForMultiPack ? 'box' : valueMode;
  const valueUnitCount = useBoxEquivalentValueForMultiPack
    ? opening.packs / opening.boxSize
    : getDistributionValueUnitCount(opening, valueMode);
  const rawDistributionValueLuck = distributionValueMode
    ? getDistributionValueLuckScore(observedValueKrw / valueUnitCount, set, distributionValueMode)
    : null;
  const distributionValueLuck = rawDistributionValueLuck && useBoxEquivalentValueForMultiPack
    ? {
        ...rawDistributionValueLuck,
        tierScore: Math.max(rawDistributionValueLuck.tierScore, 0.4),
      }
    : rawDistributionValueLuck;
  const expectedValueKrw = distributionValueLuck?.referenceValueKrw
    ? distributionValueLuck.referenceValueKrw * valueUnitCount
    : estimateReferenceValueFromCounts(expectedScoreCounts, set);
  const valueRatio = getReferenceValueRatio(observedValueKrw, expectedValueKrw);

  return {
    topCount:
      (rarityCounts.BWR ?? 0)
      + (rarityCounts.MUR ?? 0)
      + (rarityCounts.GRA ?? 0)
      + (treatsUrAsTop ? rarityCounts.UR ?? 0 : 0),
    sarCount: rarityCounts.SAR ?? 0,
    topExpected: (opening.topPerBox / opening.boxSize) * packEquivalent,
    sarExpected: (opening.sarPerBox / opening.boxSize) * packEquivalent,
    observedValueKrw,
    expectedValueKrw,
    valueRatio,
    valueSource: cards && cards.length > 0 ? getObservedReferenceValueSource(cards, set) : getObservedReferenceValueSource([], set),
    valuePercentile: distributionValueLuck?.percentile ?? null,
    valueTierScore: distributionValueLuck?.tierScore ?? null,
    valueScoreWeight: distributionValueLuck ? opening.boxes + opening.packs / opening.boxSize : 0,
    observedScore,
    expectedScore: scoreDistribution ? distributionExpectedScore(scoreDistribution) : (expectedScorePerBox / opening.boxSize) * packEquivalent,
    scoreCounts,
    expectedScoreCounts,
    scoreDistribution,
    openingUnits: opening.boxes + opening.packs / opening.boxSize,
  };
}

export function summarizeWeightedLuckEvent(
  cards: Card[],
  opening: LuckOpening,
  set?: LuckSetContext,
): WeightedLuckScore | null {
  return scoreLuckSummary(summarizeLuckRarityCounts(getRarityCounts(cards, set?.code ?? opening.setCode), opening, set, cards));
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
    return { boxSize, topPerBox: STARTER_UR_RATE, sarPerBox: STARTER_STANDARD_SAR_RATE };
  }

  if (isAnniversary25Set(set.code)) {
    return { boxSize, topPerBox: 0, sarPerBox: 0 };
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

    if (set.code === 's4a-shiny-star-v') {
      return {
        boxSize,
        topPerBox: weightChance(SHINY_STAR_V_EXTRA_SLOT_WEIGHTS, 'UR'),
        sarPerBox: 0,
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

export function summarizeLuckEvent(
  cards: Card[],
  opening: LuckOpening,
  set?: LuckSetContext,
): LuckEventSummary {
  return summarizeLuckRarityCounts(getRarityCounts(cards, set?.code ?? opening.setCode), opening, set, cards);
}
