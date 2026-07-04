export const NEW_SIM_SET_CODES = [
  'sm8b-gx-ultra-shiny',
  'sm9-tag-bolt',
  'sm8a-dark-order',
] as const;

export const NEW_SIM_SET_NAMES = [
  'GX 울트라샤이니',
  '태그볼트',
  '다크오더',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
