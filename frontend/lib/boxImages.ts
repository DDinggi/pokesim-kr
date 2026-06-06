const BOX_IMAGE_BY_SET_CODE: Record<string, string> = {
  'sv9-battle-partners': 'partners.png',
  'sv7-stellar-miracle': 'miracle.png',
  'sv7a-paradise-dragona': 'dragona.png',
};

export function getBoxImageSrc(setCode: string): string {
  const imageName = BOX_IMAGE_BY_SET_CODE[setCode];
  if (imageName?.startsWith('/')) return imageName;
  return `/boxes/${imageName ?? `${setCode}.png`}`;
}
