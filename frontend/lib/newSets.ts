export const NEW_SIM_SET_CODES = [
  'smp2-detective-pikachu',
  's8a-25th-anniversary',
  'xy6-emerald-break',
  'sm2plus-new-trials',
  'sm2k-alolan-sunlight',
  'sm2l-alolan-moonlight',
  'sm1plus-sun-moon',
  'sm1s-sun-collection',
  'sm1m-moon-collection',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NEW · 10/26';
export const LATEST_SET_UPDATE_TITLE = '신규 세트 3종 추가';
export const LATEST_SET_UPDATE_SETS = '명탐정 피카츄 · 25th ANNIVERSARY COLLECTION · 에메랄드 브레이크';

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
