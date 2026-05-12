const BOX_IMAGE_BY_SET_CODE: Record<string, string> = {
  'sv9-battle-partners': 'partners.png',
  'sv7-stellar-miracle': 'miracle.png',
  'sv7a-paradise-dragona': 'dragona.png',
};

export function getBoxImageSrc(setCode: string): string {
  return `/boxes/${BOX_IMAGE_BY_SET_CODE[setCode] ?? `${setCode}.png`}`;
}
