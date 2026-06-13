export const NEW_SIM_SET_CODES = [
  's4-amazing-volt-tackle',
  's4a-shiny-star-v',
] as const;

export const NEW_SIM_SET_NAMES = [
  '앙천의 볼트태클',
  '샤이니스타 V',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
