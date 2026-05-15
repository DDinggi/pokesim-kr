export const NEW_SIM_SET_CODES = [
  'sv6a-night-wanderer',
  'sv5a-crimson-haze',
  'sv5m-cyber-judge',
  'sv5k-wild-force',
  'sv4a-shiny-treasure-ex',
] as const;

export const NEW_SIM_SET_NAMES = [
  '나이트원더러',
  '크림슨헤이즈',
  '사이버저지',
  '와일드포스',
  '샤이니트레저ex',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
