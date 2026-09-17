export const NEW_SIM_SET_CODES = [
  'm6a-30th-celebration',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NEW · 9/16';
export const LATEST_SET_UPDATE_TITLE = '30주년 확장팩 추가';
export const LATEST_SET_UPDATE_SETS = 'MEGA 확장팩 「30th CELEBRATION」';

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
