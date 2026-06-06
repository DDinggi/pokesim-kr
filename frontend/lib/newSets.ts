export const NEW_SIM_SET_CODES = [
  's6a-eevee-heroes',
  's6h-silver-lance',
  's11a-incandescent-arcana',
  's11-lost-abyss',
  's10b-pokemon-go',
  's10a-dark-phantasma',
  's10d-time-gazer',
  's10p-space-juggler',
  's9a-battle-region',
  's9-star-birth',
] as const;

export const NEW_SIM_SET_NAMES = [
  '이브이 히어로즈',
  '백은의 랜스',
  '백열의 아르카나',
  '로스트어비스',
  'Pokemon GO',
  '다크판타스마',
  '타임게이저',
  '스페이스 저글러',
  '배틀리전',
  '스타버스',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
