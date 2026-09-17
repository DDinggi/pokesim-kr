/** Replace undersized DMM GIFs with verified Japanese 800px/500px scans. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const setPath = resolve(root, 'data/sets/m6a-30th-celebration.json');
const tsvPath = resolve(root, 'data/manual/m6a-30th-celebration-additions.tsv');
const apply = process.argv.includes('--apply');
const set = JSON.parse(readFileSync(setPath, 'utf8')) as {
  cards: Array<Record<string, unknown> & { number: number | null; image_url: string; _image_source_url?: string }>;
};
const target = set.cards.filter((card) => card.number != null && card.number >= 104 && card.number <= 165);
if (target.length !== 62) throw new Error(`Expected 62 cards, found ${target.length}`);
// Same collector numbers and rarities confirmed on yuyu-tei's m06a listing.
// These retailer scans include a watermark; do not remove it.
const retailerScans = new Set([119, 121, 128, 129, 131]);
const sourceUrl = (number: number) => retailerScans.has(number)
  ? `https://card.yuyu-tei.jp/poc/front/m06a/10${number}.jpg`
  : `https://www.serebii.net/card/30thcelebrationjapan/${number}.jpg`;
const upgrade = target;

const missing: string[] = [];
for (const card of upgrade) {
  const number = card.number!;
  const url = sourceUrl(number);
  const response = await fetch(url);
  if (!response.ok) {
    missing.push(`${number}: HTTP ${response.status}`);
    continue;
  }
  const source = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(source).metadata();
  const minWidth = retailerScans.has(number) ? 500 : 700;
  const minHeight = retailerScans.has(number) ? 700 : number === 157 ? 550 : 950;
  if (meta.format !== 'jpeg' || (meta.width ?? 0) < minWidth || (meta.height ?? 0) < minHeight) {
    missing.push(`${number}: ${meta.width}x${meta.height} ${meta.format}`);
  }
}
if (missing.length) throw new Error(`Japanese scans failed QA: ${missing.join(', ')}`);
console.log(`Verified ${upgrade.length} Japanese scans: 57 gallery scans and 5 retailer scans.`);
if (!apply) process.exit(0);

for (const card of upgrade) {
  const number = card.number!;
  card.image_url = card.image_url.replace(/\.gif$/, '.jpg');
  card._image_source_url = sourceUrl(number);
  card._image_source_page = retailerScans.has(number)
    ? 'https://yuyu-tei.jp/sell/poc/s/m06a'
    : `https://www.serebii.net/card/30thcelebrationjapan/${number}.shtml`;
  card._image_language = 'jp';
}
writeFileSync(setPath, `${JSON.stringify(set, null, 2)}\n`, 'utf8');

const lines = readFileSync(tsvPath, 'utf8').trimEnd().split(/\r?\n/);
const headers = lines[0]!.split('\t');
const imageIndex = headers.indexOf('image_url');
const sourceIndex = headers.indexOf('_image_source_url');
const numberIndex = headers.indexOf('number');
if ([imageIndex, sourceIndex, numberIndex].some((index) => index < 0)) throw new Error('Unexpected TSV header');
for (let i = 1; i < lines.length; i++) {
  const cells = lines[i]!.split('\t');
  const number = Number(cells[numberIndex]);
  if (number < 104 || number > 165) continue;
  cells[imageIndex] = cells[imageIndex]!.replace(/\.gif$/, '.jpg');
  cells[sourceIndex] = sourceUrl(number);
  lines[i] = cells.join('\t');
}
writeFileSync(tsvPath, `${lines.join('\n')}\n`, 'utf8');
console.log('Updated set JSON and manual additions TSV. Upload originals and regenerate 256/512 variants next.');
