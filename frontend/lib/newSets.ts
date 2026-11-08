export const NEW_SIM_SET_CODES = [
  'xy8-red-flash',
  'xy8-blue-shock',
  'xy7-bandit-ring',
  'smp2-detective-pikachu',
  's8a-25th-anniversary',
  'xy6-emerald-break',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NEW · 11/8';
export const LATEST_SET_UPDATE_TITLE = '신규 세트 3종 추가';
export const LATEST_SET_UPDATE_SETS = '밴디트링 · 푸른 충격 · 붉은 섬광';

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code)
    || (code === 's8a-25th-anniversary-special' && NEW_SIM_SET_CODE_SET.has('s8a-25th-anniversary'));
}

/** Show the latest update first, then the preceding update and existing sets. */
export function sortNewSimSetsFirst<T extends { code: string }>(sets: T[]): T[] {
  const rank = (code: string) => {
    const canonical = code === 's8a-25th-anniversary-special' ? 's8a-25th-anniversary' : code;
    const index = NEW_SIM_SET_CODES.findIndex(candidate => candidate === canonical);
    return index < 0 ? 2 : index < 3 ? 0 : 1;
  };
  return [...sets].sort((a, b) => rank(a.code) - rank(b.code));
}
