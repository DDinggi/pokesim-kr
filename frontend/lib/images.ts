const DEFAULT_CARD_IMAGE_CDN_BASE = 'https://img.pokesim.kr/';

export const CARD_IMAGE_CDN_BASE =
  process.env.NEXT_PUBLIC_CARD_IMAGE_CDN_BASE ?? DEFAULT_CARD_IMAGE_CDN_BASE;
export const CARD_IMAGE_VARIANTS_ENABLED =
  process.env.NEXT_PUBLIC_CARD_IMAGE_VARIANTS === '1';

export type CardImageVariantSize = 256 | 512;

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function stripExtension(path: string): string {
  return path.replace(/\.[a-zA-Z0-9]+$/, '');
}

export function cardImageVariantKey(
  imageUrl: string,
  size: CardImageVariantSize,
): string | null {
  if (!imageUrl || /^https?:\/\//.test(imageUrl)) return null;
  const key = imageUrl.replace(/^\/+/, '');
  return `cards/${size}/${stripExtension(key)}.webp`;
}

export function resolveCardImageUrl(
  imageUrl: string,
  options: { size?: CardImageVariantSize } = {},
): string {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  const key =
    CARD_IMAGE_VARIANTS_ENABLED && options.size
      ? cardImageVariantKey(imageUrl, options.size)
      : null;
  return joinUrl(CARD_IMAGE_CDN_BASE, key ?? imageUrl);
}

export function preloadCardImages(
  imageUrls: string[],
  options: {
    limit?: number;
    chunkSize?: number;
    delayMs?: number;
    size?: CardImageVariantSize;
  } = {},
) {
  if (typeof window === 'undefined') return;

  const limit = options.limit ?? 16;
  const chunkSize = options.chunkSize ?? 4;
  const delayMs = options.delayMs ?? 120;
  const urls = Array.from(new Set(imageUrls.filter(Boolean)))
    .slice(0, limit)
    .map((imageUrl) => resolveCardImageUrl(imageUrl, { size: options.size ?? 256 }));

  let index = 0;
  function next() {
    const chunk = urls.slice(index, index + chunkSize);
    if (chunk.length === 0) return;

    chunk.forEach((src) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = src;
    });

    index += chunkSize;
    if (index < urls.length) window.setTimeout(next, delayMs);
  }

  next();
}
