export const NEW_SIM_SET_CODES = [
  'sv2p-snow-hazard',
  'sv2d-clay-burst',
  'sv1s-scarlet-ex',
  'sv1v-violet-ex',
  's12-paradigm-trigger',
] as const;

export const NEW_SIM_SET_NAMES = [
  '스노해저드',
  '클레이버스트',
  '스칼렛 ex',
  '바이올렛 ex',
  '패러다임트리거',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
