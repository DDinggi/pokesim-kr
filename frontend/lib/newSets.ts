export const NEW_SIM_SET_CODES = [
  'm6a-30th-celebration',
  'sm2plus-new-trials',
  'sm2k-alolan-sunlight',
  'sm2l-alolan-moonlight',
  'sm1plus-sun-moon',
  'sm1s-sun-collection',
  'sm1m-moon-collection',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NEW · 10/8';
export const LATEST_SET_UPDATE_TITLE = '고전 확장팩 6종 추가';
export const LATEST_SET_UPDATE_SETS = '새로운 시련 · 알로라의 햇빛 · 알로라의 달빛 · 강화 썬&문 · 썬 컬렉션 · 문 컬렉션';

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
