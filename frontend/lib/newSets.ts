export const NEW_SIM_SET_CODES = [
  'sm6a-dragon-storm',
  'sm6-forbidden-light',
  'sm5plus-ultra-force',
] as const;

export const NEW_SIM_SET_NAMES = [
  '드래곤스톰',
  '금단의 빛',
  '울트라포스',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
