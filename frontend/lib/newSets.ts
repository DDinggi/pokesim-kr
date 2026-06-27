export const NEW_SIM_SET_CODES = [
  'sm10b-sky-legend',
  'sm10a-gg-end',
  'sm10-double-blaze',
] as const;

export const NEW_SIM_SET_NAMES = [
  '스카이레전드',
  'GG엔드',
  '더블블레이즈',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
