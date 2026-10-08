import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : (process.argv[index + 1] ?? fallback);
}
function dimension(name: string, fallback: number): number {
  const value = Number(arg(name, String(fallback)));
  assert.ok(Number.isInteger(value) && value > 0, `${name}: positive integer required`);
  return value;
}
const codes = arg('--set', '').split(',').filter(Boolean);
assert.ok(codes.length, 'Usage: pnpm validate:box-images -- --set <code,...> [--thumbnail 512]');
const canvas = dimension('--canvas', 768);
const thumbnail = dimension('--thumbnail', 768);
const productHeight = dimension('--product-height', 708);
assert.ok(productHeight < canvas, 'Foreground must leave transparent padding');

for (const code of codes) {
  assert.match(code, /^[a-z0-9-]+$/);
  const pngPath = resolve(root, `frontend/public/boxes/${code}.png`);
  const webpPath = resolve(root, `frontend/public/boxes/thumbs/${code}.webp`);
  for (const [path, size, format] of [[pngPath, canvas, 'png'], [webpPath, thumbnail, 'webp']] as const) {
    const metadata = await sharp(path).metadata();
    assert.equal(metadata.format, format, path);
    assert.equal(metadata.width, size, path);
    assert.equal(metadata.height, size, path);
    assert.equal(metadata.hasAlpha, true, `${path}: alpha channel missing`);
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 4);
    let left = size, top = size, right = -1, bottom = -1, opaquePixels = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const alpha = data[(y * size + x) * 4 + 3];
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) {
          assert.equal(alpha, 0, `${path}: nontransparent outer border`);
        }
        if (alpha < 8) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        if (alpha >= 200) opaquePixels++;
      }
    }
    assert.ok(opaquePixels > size * size * .1, `${path}: foreground missing/mostly transparent`);
    const width = right - left + 1, height = bottom - top + 1;
    assert.ok(Math.abs(Math.max(width, height) - productHeight * size / canvas) <= 3, `${path}: foreground scale mismatch`);
    assert.ok(Math.abs(left - (size - 1 - right)) <= 3, `${path}: horizontal centering mismatch`);
    assert.ok(Math.abs(top - (size - 1 - bottom)) <= 3, `${path}: vertical centering mismatch`);
    console.log(`${code}: ${format} ${size}x${size}, foreground ${width}x${height}, transparent/centered, ${(await stat(path)).size} bytes`);
  }
  // Alpha is encoded losslessly: confirm the thumbnail belongs to this PNG.
  const expected = await sharp(pngPath).resize(thumbnail, thumbnail, { kernel: sharp.kernel.lanczos3 }).ensureAlpha().raw().toBuffer();
  const actual = await sharp(webpPath).ensureAlpha().raw().toBuffer();
  let alphaDifference = 0;
  for (let offset = 3; offset < actual.length; offset += 4) alphaDifference += Math.abs(actual[offset] - expected[offset]);
  assert.ok(alphaDifference / (thumbnail * thumbnail) < 1, `${code}: PNG/WebP alpha mismatch`);
}
console.log(`Box image validation passed: ${codes.length} PNG/WebP pairs. Text/orientation require visual review.`);
