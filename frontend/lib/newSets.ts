export const NEW_SIM_SET_CODES = [
  's3a-legendary-heartbeat',
  's3-infinity-zone',
  's2a-explosive-walker',
  's2-rebellion-crash',
] as const;

export const NEW_SIM_SET_NAMES = [
  '전설의 고동',
  '무한존',
  '폭염워커',
  '반역크래시',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
