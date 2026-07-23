export const NEW_SIM_SET_CODES = [
  'sm7b-fairy-rise',
  'sm7-sky-charisma',
  'sm6b-champion-road',
] as const;

export const NEW_SIM_SET_NAMES = [
  '페어리라이즈',
  '창공의 카리스마',
  '챔피언로드',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
