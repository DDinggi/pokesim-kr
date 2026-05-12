import type { Card } from '../types';

export interface BuildContext {
  byRarity: Record<string, Card[]>;
  pick: <T>(arr: T[]) => T;
  weightedPick: (weights: Record<string, number>) => string;
}

export interface HiClassHitSlot {
  rarity: string;
  pool?: Card[];
}

export type StandardHighKey = 'SR_POKEMON' | 'SR_TRAINER' | 'SAR' | 'UR';

export interface StandardSvSetRate {
  mandatoryHighWeights: Record<StandardHighKey, number>;
  extraHighRate: number;
  extraHighWeights: Record<'SR_POKEMON' | 'SR_TRAINER', number>;
  rrBaseCount: number;
  rrExtraRate: number;
  fillerWeights: Record<string, number>;
}
