export const NEW_SIM_SET_CODES = [
  'sv9-battle-partners',
  'sv7-stellar-miracle',
  'sv7a-paradise-dragona',
] as const;

export const NEW_SIM_SET_NAMES = ['배틀파트너즈', '스텔라미라클', '낙원드래고나'];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
