export const NEW_SIM_SET_CODES = [
  's12a-vstar-universe',
  'sv4k-ancient-roar',
  'sv4m-future-flash',
  'sv3a-raging-surf',
  'sv3-black-flame-ruler',
] as const;

export const NEW_SIM_SET_NAMES = [
  'VSTAR 유니버스',
  '고대의 포효',
  '미래의 일섬',
  '레이징서프',
  '흑염의 지배자',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
