import type { SetMeta } from './types';

export const SET_SERIES = [
  { key: 'mega', label: 'MEGA 확장팩', shortLabel: 'MEGA' },
  { key: 'sv', label: '스칼렛&바이올렛', shortLabel: 'SV' },
  { key: 'swsh', label: '소드&실드', shortLabel: 'SWSH' },
  { key: 'sm', label: '썬&문', shortLabel: 'SM' },
  { key: 'other', label: '기타', shortLabel: 'ETC' },
] as const;

export type SetSeriesKey = (typeof SET_SERIES)[number]['key'];

export interface AvailableSetSeries {
  key: SetSeriesKey;
  label: string;
  shortLabel: string;
  count: number;
}

export function getSetSeriesKey(setOrCode: Pick<SetMeta, 'code'> | string): SetSeriesKey {
  const code = typeof setOrCode === 'string' ? setOrCode : setOrCode.code;
  if (code.startsWith('m')) return 'mega';
  if (code.startsWith('sv')) return 'sv';
  if (code.startsWith('sm')) return 'sm';
  if (code.startsWith('s')) return 'swsh';
  return 'other';
}

export function getAvailableSetSeries(sets: Array<Pick<SetMeta, 'code'>>): AvailableSetSeries[] {
  const counts = new Map<SetSeriesKey, number>();
  for (const set of sets) {
    const key = getSetSeriesKey(set);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return SET_SERIES
    .map((series) => ({ ...series, count: counts.get(series.key) ?? 0 }))
    .filter((series) => series.count > 0);
}
