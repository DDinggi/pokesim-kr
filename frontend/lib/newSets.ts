export const NEW_SIM_SET_CODES = [
  'sm11a-remix-bout',
  'sm8b-gx-ultra-shiny',
  'sm11-miracle-twin',
] as const;

export const NEW_SIM_SET_NAMES = [
  '리믹스바우트',
  'GX 울트라샤이니 ULTIMATE',
  '미라클트윈',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
