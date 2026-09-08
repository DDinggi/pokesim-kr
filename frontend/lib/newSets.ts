export const NEW_SIM_SET_CODES = [
  'm6-storm-emerald',
  'sm3plus-shining-legends',
  'sm4s-awakened-heroes',
  'sm4a-ultradimensional-beasts',
  'smxy-best-of-xy',
  'sm3h-rainbow-in-darkness',
  'sm3n-darkness-devours-light',
] as const;

export const LATEST_SET_UPDATE_LABEL = 'NEW · 9/8';
export const LATEST_SET_UPDATE_TITLE = '고전 확장팩 6종 추가';
export const LATEST_SET_UPDATE_SETS = '빛나는 전설 · 각성의 용사 · 초차원의 침략자 · THE BEST OF XY · 어둠을 밝힌 무지개 · 빛을 삼킨 어둠';

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
