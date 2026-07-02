export const NEW_SIM_SET_CODES = [
  'sm9b-full-metal-wall',
  'sm9a-night-unison',
] as const;

export const NEW_SIM_SET_NAMES = [
  '풀메탈월',
  '나이트유니슨',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
