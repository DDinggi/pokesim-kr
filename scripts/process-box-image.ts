import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInt(name: string, fallback: number): number {
  const raw = argValue(name);
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const inputArg = argValue('--input');
const setCode = argValue('--set');

if (!inputArg || !setCode) {
  throw new Error(
    'Usage: pnpm process:box-image -- --input <source.png> --set <set-code>',
  );
}

if (!/^[a-z0-9-]+$/.test(setCode)) {
  throw new Error(`Invalid set code: ${setCode}`);
}

const canvasSize = positiveInt('--canvas', 768);
const productHeight = positiveInt('--product-height', 708);
const thumbnailSize = positiveInt('--thumbnail', 768);
const backgroundThreshold = positiveInt('--background-threshold', 190);
const maxChroma = positiveInt('--max-chroma', 40);

if (productHeight > canvasSize) {
  throw new Error('--product-height cannot exceed --canvas');
}
if (backgroundThreshold > 255 || maxChroma > 255) {
  throw new Error('Background thresholds must be between 1 and 255');
}

const inputPath = isAbsolute(inputArg) ? inputArg : resolve(ROOT, inputArg);
const boxesDir = join(ROOT, 'frontend', 'public', 'boxes');
const outputPath = join(boxesDir, `${setCode}.png`);
const thumbnailPath = join(boxesDir, 'thumbs', `${setCode}.webp`);

const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixelCount = info.width * info.height;
let sourceHasTransparency = false;
for (let offset = 3; offset < data.length; offset += 4) {
  if (data[offset] < 255) {
    sourceHasTransparency = true;
    break;
  }
}
const connectedBackground = new Uint8Array(pixelCount);
const queue = new Uint32Array(pixelCount);
let queueHead = 0;
let queueTail = 0;

function isBackgroundCandidate(pixelIndex: number): boolean {
  const offset = pixelIndex * 4;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const alpha = data[offset + 3];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  return alpha === 0
    || (!sourceHasTransparency && minimum >= backgroundThreshold && maximum - minimum <= maxChroma);
}

function enqueue(pixelIndex: number): void {
  if (connectedBackground[pixelIndex] || !isBackgroundCandidate(pixelIndex)) return;
  connectedBackground[pixelIndex] = 1;
  queue[queueTail] = pixelIndex;
  queueTail += 1;
}

for (let x = 0; x < info.width; x += 1) {
  enqueue(x);
  enqueue((info.height - 1) * info.width + x);
}
for (let y = 0; y < info.height; y += 1) {
  enqueue(y * info.width);
  enqueue(y * info.width + info.width - 1);
}

while (queueHead < queueTail) {
  const pixelIndex = queue[queueHead];
  queueHead += 1;
  const x = pixelIndex % info.width;
  const y = Math.floor(pixelIndex / info.width);

  if (x > 0) enqueue(pixelIndex - 1);
  if (x + 1 < info.width) enqueue(pixelIndex + 1);
  if (y > 0) enqueue(pixelIndex - info.width);
  if (y + 1 < info.height) enqueue(pixelIndex + info.width);
}

const cutout = Buffer.from(data);
let minX = info.width;
let minY = info.height;
let maxX = -1;
let maxY = -1;

for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
  const offset = pixelIndex * 4;
  if (connectedBackground[pixelIndex]) {
    cutout[offset] = 0;
    cutout[offset + 1] = 0;
    cutout[offset + 2] = 0;
    cutout[offset + 3] = 0;
    continue;
  }

  if (cutout[offset + 3] === 0) continue;
  const x = pixelIndex % info.width;
  const y = Math.floor(pixelIndex / info.width);
  minX = Math.min(minX, x);
  minY = Math.min(minY, y);
  maxX = Math.max(maxX, x);
  maxY = Math.max(maxY, y);
}

if (maxX < minX || maxY < minY) {
  throw new Error('No foreground remained after background extraction');
}

const foregroundWidth = maxX - minX + 1;
const foregroundHeight = maxY - minY + 1;
const { data: resized, info: resizedInfo } = await sharp(cutout, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .extract({ left: minX, top: minY, width: foregroundWidth, height: foregroundHeight })
  .resize({
    width: productHeight,
    height: productHeight,
    fit: 'inside',
    kernel: sharp.kernel.lanczos3,
  })
  .png()
  .toBuffer({ resolveWithObject: true });

const left = Math.floor((canvasSize - resizedInfo.width) / 2);
const top = Math.floor((canvasSize - resizedInfo.height) / 2);

await mkdir(dirname(thumbnailPath), { recursive: true });
await sharp({
  create: {
    width: canvasSize,
    height: canvasSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: resized, left, top }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outputPath);

await sharp(outputPath)
  .resize(thumbnailSize, thumbnailSize, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
  .toFile(thumbnailPath);

console.log(
  JSON.stringify(
    {
      input: inputPath,
      backgroundPixelsRemoved: queueTail,
      sourceForeground: {
        left: minX,
        top: minY,
        width: foregroundWidth,
        height: foregroundHeight,
      },
      output: {
        path: outputPath,
        width: canvasSize,
        height: canvasSize,
        productWidth: resizedInfo.width,
        productHeight: resizedInfo.height,
      },
      thumbnail: {
        path: thumbnailPath,
        width: thumbnailSize,
        height: thumbnailSize,
      },
    },
    null,
    2,
  ),
);
