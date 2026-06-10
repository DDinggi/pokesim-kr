export const NEW_SIM_SET_CODES = [
  's6k-jet-black-spirit',
  's5a-matchless-fighters',
  's5i-single-strike-master',
  's5r-rapid-strike-master',
] as const;

export const NEW_SIM_SET_NAMES = [
  '칠흑의 가이스트',
  '쌍벽의 파이터',
  '일격마스터',
  '연격마스터',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
