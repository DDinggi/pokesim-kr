export const NEW_SIM_SET_CODES = [
  's11a-incandescent-arcana',
  's11-lost-abyss',
  's10a-dark-phantasma',
  's10d-time-gazer',
  's10p-space-juggler',
] as const;

export const NEW_SIM_SET_NAMES = [
  '백열의 아르카나',
  '로스트어비스',
  '다크판타스마',
  '타임게이저',
  '스페이스 저글러',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
