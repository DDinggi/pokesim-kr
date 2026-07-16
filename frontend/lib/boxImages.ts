export function getBoxImageSrc(setCode: string): string {
  return `/boxes/${setCode}.png`;
}

export function getBoxThumbnailImageSrc(setCode: string): string {
  return `/boxes/thumbs/${setCode}.webp`;
}
