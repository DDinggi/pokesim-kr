import type { Card, SetMeta } from './types';
import {
  ALT_SR_NUMBER_RANGES,
  isAnniversary25Set,
  isMegaExpansionSet,
  isStarterSet,
} from './simulation/model';

const POKEMON_CARD_TYPE = '포켓몬';
export type ReferenceValueSource = 'source' | 'manual' | 'mixed' | 'unknown';
export type ValueLuckMode = 'box' | 'pack';

export interface ReferenceValueSummary {
  observedValueKrw: number;
  expectedValueKrw: number;
  valueRatio: number | null;
  valueSource: ReferenceValueSource;
}

export interface DistributionValueLuckScore {
  percentile: number;
  tierScore: number;
  referenceValueKrw: number;
}

const VALUE_PERCENTILE_TIER_POINTS: Array<[percentile: number, tierScore: number]> = [
  [0, -0.8],
  [0.05, -0.45],
  [0.1, -0.25],
  [0.2, 0],
  [0.3, 0.15],
  [0.4, 0.3],
  [0.5, 0.4],
  [0.6, 0.65],
  [0.7, 0.85],
  [0.8, 1],
  [0.9, 1.3],
  [0.95, 1.55],
  [0.98, 1.8],
  [0.99, 2],
  [1, 2.2],
];

function isInRanges(number: number, ranges: Array<[number, number]> | undefined): boolean {
  return Boolean(ranges?.some(([start, end]) => number >= start && number <= end));
}

function isLowScoreUrSet(setCode?: string): boolean {
  return Boolean(
    setCode
      && !isStarterSet(setCode)
      && !isMegaExpansionSet(setCode)
      && !isAnniversary25Set(setCode),
  );
}

export function getValueCountKeyForCard(card: Card, setCode?: string): string | null {
  if (!card.rarity) return null;

  if (card.rarity === 'UR' && (isMegaExpansionSet(setCode) || isStarterSet(setCode))) {
    return 'MUR';
  }

  if (isLowScoreUrSet(setCode) && card.rarity === 'UR' && card.card_type !== POKEMON_CARD_TYPE) {
    return 'UR_LOW';
  }

  if (
    card.rarity === 'SR'
    && card.card_type === POKEMON_CARD_TYPE
    && setCode
    && isInRanges(card.number, ALT_SR_NUMBER_RANGES[setCode])
  ) {
    return 'SR_ALT';
  }

  return card.rarity;
}

export function getCardReferenceValueKrw(card: Card, setCode?: string): number {
  void setCode;
  if (
    card.price_confidence !== 'proxy'
    && typeof card.price_ref_krw === 'number'
    && Number.isFinite(card.price_ref_krw)
    && card.price_ref_krw > 0
  ) {
    return card.price_ref_krw;
  }

  return 0;
}

export function getCardReferenceValueSource(card: Card): Exclude<ReferenceValueSource, 'mixed'> {
  if (getCardReferenceValueKrw(card) <= 0) return 'unknown';
  if (card.price_confidence === 'manual') return 'manual';
  return 'source';
}

export function getSetValueAverages(set?: Pick<SetMeta, 'code' | 'cards'>): Record<string, number> {
  const averages: Record<string, number> = {};
  if (!set) return averages;

  const buckets = new Map<string, { total: number; count: number }>();
  for (const card of set.cards) {
    const key = getValueCountKeyForCard(card, set.code);
    if (!key) continue;

    const value = getCardReferenceValueKrw(card, set.code);
    if (value <= 0) continue;

    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += value;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  for (const [key, bucket] of buckets) {
    averages[key] = bucket.count > 0 ? bucket.total / bucket.count : 0;
  }

  return averages;
}

export function getSetReferenceValueSource(set?: Pick<SetMeta, 'code' | 'cards'>): ReferenceValueSource {
  if (!set) return 'unknown';

  let sourceCount = 0;
  let manualCount = 0;

  for (const card of set.cards) {
    if (getCardReferenceValueKrw(card, set.code) <= 0) continue;
    if (getCardReferenceValueSource(card) === 'manual') manualCount++;
    else sourceCount++;
  }

  if (sourceCount > 0 && manualCount > 0) return 'mixed';
  if (manualCount > 0) return 'manual';
  if (sourceCount > 0) return 'source';
  return 'unknown';
}

export function getObservedReferenceValueKrw(cards: Card[], set?: Pick<SetMeta, 'code'>): number {
  return cards.reduce((sum, card) => sum + getCardReferenceValueKrw(card, set?.code), 0);
}

export function getObservedReferenceValueSource(
  cards: Card[],
  set?: Pick<SetMeta, 'code'>,
): ReferenceValueSource {
  let sourceCount = 0;
  let manualCount = 0;

  for (const card of cards) {
    if (getCardReferenceValueKrw(card, set?.code) <= 0) continue;
    if (getCardReferenceValueSource(card) === 'manual') manualCount++;
    else sourceCount++;
  }

  if (sourceCount > 0 && manualCount > 0) return 'mixed';
  if (manualCount > 0) return 'manual';
  if (sourceCount > 0) return 'source';
  return 'unknown';
}

export function estimateReferenceValueFromCounts(
  counts: Record<string, number> | undefined,
  set?: Pick<SetMeta, 'code' | 'cards'>,
): number {
  if (!counts) return 0;

  const averages = getSetValueAverages(set);
  return Object.entries(counts).reduce((sum, [key, count]) => {
    const value = averages[key] ?? 0;
    return sum + value * count;
  }, 0);
}

function interpolateByPoints(points: Array<[number, number]>, x: number): number {
  if (points.length === 0) return 0;
  if (x <= points[0][0]) return points[0][1];

  for (let i = 0; i < points.length - 1; i++) {
    const [leftX, leftY] = points[i];
    const [rightX, rightY] = points[i + 1];
    if (x > rightX) continue;

    if (rightX === leftX) return (leftY + rightY) / 2;
    const t = (x - leftX) / (rightX - leftX);
    return leftY + (rightY - leftY) * Math.max(0, Math.min(1, t));
  }

  return points[points.length - 1][1];
}

function percentileFromQuantiles(value: number, quantiles: number[], points: number[]): number | null {
  if (quantiles.length === 0 || quantiles.length !== points.length || !Number.isFinite(value)) {
    return null;
  }

  const exactIndexes = quantiles
    .map((quantile, index) => (quantile === value ? index : -1))
    .filter((index) => index >= 0);
  if (exactIndexes.length > 0) {
    const first = exactIndexes[0];
    const last = exactIndexes[exactIndexes.length - 1];
    return (points[first] + points[last]) / 2;
  }

  if (value < quantiles[0]) return points[0];
  if (value > quantiles[quantiles.length - 1]) return points[points.length - 1];

  for (let i = 0; i < quantiles.length - 1; i++) {
    const leftValue = quantiles[i];
    const rightValue = quantiles[i + 1];
    if (value < leftValue || value > rightValue) continue;

    if (rightValue === leftValue) return (points[i] + points[i + 1]) / 2;
    const t = (value - leftValue) / (rightValue - leftValue);
    return points[i] + (points[i + 1] - points[i]) * Math.max(0, Math.min(1, t));
  }

  return null;
}

export function getValueTierScoreFromPercentile(percentile: number): number {
  return interpolateByPoints(VALUE_PERCENTILE_TIER_POINTS, Math.max(0, Math.min(1, percentile)));
}

function getPositiveReferenceValue(referenceValueKrw: number, quantiles: number[]): number | null {
  if (Number.isFinite(referenceValueKrw) && referenceValueKrw > 0) return referenceValueKrw;

  const positiveQuantile = quantiles.find((value) => Number.isFinite(value) && value > 0);
  return positiveQuantile ?? null;
}

export function getDistributionValueLuckScore(
  observedValueKrw: number,
  set?: Pick<SetMeta, 'luck_value_ref'>,
  mode: ValueLuckMode = 'box',
): DistributionValueLuckScore | null {
  const ref = set?.luck_value_ref;
  if (!ref || !Number.isFinite(observedValueKrw)) return null;

  const quantiles = mode === 'pack' ? ref.pack_quantiles_krw : ref.box_quantiles_krw;
  const referenceValueKrw = getPositiveReferenceValue(
    mode === 'pack' ? ref.pack_median_krw : ref.box_median_krw,
    quantiles,
  );
  const rawPercentile = percentileFromQuantiles(observedValueKrw, quantiles, ref.quantile_points);
  const percentile = mode === 'pack' && observedValueKrw <= 0 && ref.pack_median_krw <= 0
    ? Math.max(rawPercentile ?? 0, 0.5)
    : rawPercentile;
  if (percentile === null || referenceValueKrw === null) {
    return null;
  }

  return {
    percentile,
    tierScore: getValueTierScoreFromPercentile(percentile),
    referenceValueKrw,
  };
}

export function getReferenceValueRatio(observedValueKrw: number, expectedValueKrw: number): number | null {
  if (!Number.isFinite(observedValueKrw) || !Number.isFinite(expectedValueKrw) || expectedValueKrw <= 0) {
    return null;
  }

  return observedValueKrw / expectedValueKrw;
}
