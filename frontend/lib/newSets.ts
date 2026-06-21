export const NEW_SIM_SET_CODES = [
  's1a-vmax-rising',
  's1w-sword',
  's1h-shield',
  'sm12a-tag-team-gx-tag-all-stars',
  'sm12-alter-genesis',
  'sm11b-dream-league',
] as const;

export const NEW_SIM_SET_NAMES = [
  'VMAX\uB77C\uC774\uC9D5',
  '\uC18C\uB4DC',
  '\uC2E4\uB4DC',
  'TAG TEAM GX \uD0DC\uADF8\uC62C\uC2A4\uD0C0\uC988',
  '\uC5BC\uD130\uC81C\uB124\uC2DC\uC2A4',
  '\uB4DC\uB9BC\uB9AC\uADF8',
];

const NEW_SIM_SET_CODE_SET = new Set<string>(NEW_SIM_SET_CODES);

export function isNewSimSet(code: string): boolean {
  return NEW_SIM_SET_CODE_SET.has(code);
}
