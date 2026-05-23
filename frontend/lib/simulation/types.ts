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

export type StandardHighKey =
  | 'SR_POKEMON'
  | 'SR_ALT'
  | 'SR_TRAINER'
  | 'CSR'
  | 'HR_POKEMON'
  | 'HR_TRAINER'
  | 'SAR'
  | 'UR'
  | 'BWR';

export interface StandardSvSetRate {
  mandatoryHighWeights: Partial<Record<StandardHighKey, number>>;
  extraHighRate: number;
  extraHighWeights: Partial<Record<StandardHighKey, number>>;
  arCount?: number;
  chrCount?: number;
  kCount?: number;
  boxSize?: number;
  rrBaseCount: number;
  rrExtraRate: number;
  rrrBaseCount?: number;
  rrrExtraRate?: number;
  fillerWeights: Record<string, number>;
}
