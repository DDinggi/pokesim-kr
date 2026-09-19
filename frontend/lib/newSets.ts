export const NEW_SIM_SET_CODES = [
  'm6a-30th-celebration',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NOTICE · 9/20';
export const LATEST_SET_UPDATE_TITLE = '30주년 봉입률 수정';
export const LATEST_SET_UPDATE_SETS = '';

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
