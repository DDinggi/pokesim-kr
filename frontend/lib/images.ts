const DEFAULT_CARD_IMAGE_CDN_BASE = 'https://img.pokesim.kr/';
// Legacy originals were missing and fallback sources were replaced on 2026-09-08.
// Invalidate prior missing-original responses as well as old undersized variants.
const DEFAULT_CARD_IMAGE_CACHE_VERSION = 'sm-legacy-reviewed-20260908';

export const CARD_IMAGE_CDN_BASE =
  process.env.NEXT_PUBLIC_CARD_IMAGE_CDN_BASE ?? DEFAULT_CARD_IMAGE_CDN_BASE;
export const CARD_IMAGES_ENABLED = !['0', 'false', 'off'].includes(
  (process.env.NEXT_PUBLIC_CARD_IMAGES_ENABLED ?? '1').toLowerCase(),
);
export const CARD_IMAGE_VARIANTS_ENABLED =
  process.env.NEXT_PUBLIC_CARD_IMAGE_VARIANTS === '1';
export const CARD_IMAGE_ORIGINAL_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_CARD_IMAGE_ORIGINAL_FALLBACK === '1';
// R2 variants are immutable. Bump this at build time whenever an existing
// variant key is regenerated so returning browsers do not keep the old WebP.
export const CARD_IMAGE_CACHE_VERSION =
  process.env.NEXT_PUBLIC_CARD_IMAGE_CACHE_VERSION?.trim() || DEFAULT_CARD_IMAGE_CACHE_VERSION;

export type CardImageVariantSize = 256 | 512;

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function stripExtension(path: string): string {
  return path.replace(/\.[a-zA-Z0-9]+$/, '');
}

function withCacheVersion(url: string, imageUrl: string): string {
  const version = imageUrl.startsWith('external/m6a-30th-celebration/')
    ? `${CARD_IMAGE_CACHE_VERSION}-m6a-jp-20260917-v2`
    : CARD_IMAGE_CACHE_VERSION;
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
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
  if (!CARD_IMAGES_ENABLED) return '';
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  // Older opening-history snapshots still contain the original 180px GIF keys.
  // All 104–165 Japanese supplements now have verified higher-resolution JPEGs.
  const legacyM6a = imageUrl.match(/^external\/m6a-30th-celebration\/JP2026M6A(\d{3})\.gif$/);
  if (legacyM6a && Number(legacyM6a[1]) >= 104 && Number(legacyM6a[1]) <= 165) {
    imageUrl = imageUrl.replace(/\.gif$/, '.jpg');
  }
  const key =
    CARD_IMAGE_VARIANTS_ENABLED && options.size
      ? cardImageVariantKey(imageUrl, options.size)
      : null;
  return withCacheVersion(joinUrl(CARD_IMAGE_CDN_BASE, key ?? imageUrl), imageUrl);
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
  if (typeof window === 'undefined' || !CARD_IMAGES_ENABLED) return;

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
