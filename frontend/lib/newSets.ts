export const NEW_SIM_SET_CODES = [
  'sm5s-ultra-sun',
  'sm5m-ultra-moon',
  'sm4plus-gx-battle-boost',
] as const;

export const NEW_SIM_SET_NAMES = [
  '울트라썬',
  '울트라문',
  'GX 배틀부스트',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
