export const NEW_SIM_SET_CODES = [
  'sm7a-plasma-spark',
  'sm4plus-gx-battle-boost-remaster',
  'sm8-burst-impact',
] as const;

export const NEW_SIM_SET_NAMES = [
  '플라스마 스파크',
  'GX배틀부스트 REMASTER',
  '버스트임팩트',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
