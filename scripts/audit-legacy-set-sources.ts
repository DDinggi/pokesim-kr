import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'node-html-parser';
import sharp from 'sharp';

// Read-only source audit. Only cached evidence/contact sheets are written.
const root = resolve(import.meta.dirname, '..');
const out = join(root, '.tmp', 'sm-source-audit');
mkdirSync(out, { recursive: true });
const codes = ['sm3plus-shining-legends', 'sm4s-awakened-heroes', 'sm4a-ultradimensional-beasts', 'smxy-best-of-xy', 'sm3h-rainbow-in-darkness', 'sm3n-darkness-devours-light'];
const selected = process.argv.includes('--set') ? [process.argv[process.argv.indexOf('--set') + 1]] : codes;
const reviewed = JSON.parse(readFileSync(join(root, 'data/manual/sm-legacy-reviewed-cards.json'), 'utf8'));
let mismatchCount = 0;
function imageKey(code: string, card: any): string {
  return `${code}-${card.card_num}-${createHash('sha256').update(card._image_source_url || card.image_url).digest('hex').slice(0, 12)}.image`;
}
async function cached(url: string, key: string): Promise<Buffer> {
  const path = join(out, key);
  if (existsSync(path)) return readFileSync(path);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const data = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, data);
  return data;
}
async function mapLimit<T, R>(values: T[], fn: (v: T, i: number) => Promise<R>): Promise<R[]> {
  const result: R[] = []; let index = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (index < values.length) { const i = index++; result[i] = await fn(values[i], i); }
  }));
  return result;
}
for (const code of selected) {
  const set = JSON.parse(readFileSync(join(root, 'data', 'sets', `${code}.json`), 'utf8'));
  const review = reviewed.sets.find((s: any) => s.set_code === code);
  if (!review) throw new Error(`No reviewed manifest for ${code}`);
  const shop = review.cards[0].rarity_source.match(/\/card\/([^/]+)\//)?.[1];
  const jpList = parse((await cached(`https://yuyu-tei.jp/sell/poc/s/${shop}`, `yuyu-${shop}.html`)).toString('utf8'));
  const jpNumbers = [...new Set(jpList.querySelectorAll('img').map(img => Number(img.getAttribute('alt')?.match(/^(\d{3})\//)?.[1])).filter(Number.isFinite))];
  const localNumbers = new Set(set.cards.map((c: any) => c._jp_number ?? c.number));
  const missingNumbers = jpNumbers.filter(n => !localNumbers.has(n));
  if (missingNumbers.length) throw new Error(`${code}: missing Japanese numbers ${missingNumbers.join(', ')}`);
  console.log(`${code}: Japanese list coverage ${jpNumbers.length}, missing=0`);
  const records = await mapLimit<any, any>(set.cards, async (card) => {
    const result: any = { number: card.number, card_num: card.card_num, name_ko: card.name_ko, rarity: card.rarity, mismatches: [] };
    if (card._source?.startsWith('https://pokemoncard.co.kr/cards/detail/')) {
      const html = parse((await cached(card._source, `${card.card_num}.html`)).toString('utf8'));
      result.official = {
        name: html.querySelector('.detail_wrap .header .card-hp.title')?.text.trim(),
        number: Number(html.querySelector('.p_num')?.text.match(/(\d+)\//)?.[1]) || null,
        rarityText: html.querySelector('#no_wrap_by_admin')?.text.trim(),
        raritySymbols: html.querySelectorAll('#no_wrap_by_admin img').map(n => n.getAttribute('title')),
        image: html.querySelector('.feature_image')?.getAttribute('src'),
      };
      if (result.official.name !== card.name_ko) result.mismatches.push('name');
      if (result.official.number !== card.number) result.mismatches.push('number');
      const token = result.official.rarityText?.match(/\b(SR|HR|UR|RR|R|U|C)\b/)?.[1];
      if (token && token !== card.rarity) result.mismatches.push('rarity');
      if (result.official.image && !result.official.image.includes(card.image_url)) result.mismatches.push('image');
    }
    if (['SR', 'HR', 'UR', 'H'].includes(card.rarity)) {
      const expected = review.cards.find((c: any) => c.card_num === card.card_num);
      if (!expected) throw new Error(`Unreviewed high rarity: ${card.card_num}`);
      for (const field of ['number', 'name_ko', 'rarity']) {
        if (expected[field] !== card[field]) result.mismatches.push(`reviewed:${field}`);
      }
      if (expected.jp_number !== card._jp_number) result.mismatches.push('jp_number');
      const reference = parse((await cached(`https://pokemoncard.co.kr/cards/detail/${expected.name_source_card_num}`, `${expected.name_source_card_num}.html`)).toString('utf8'));
      if (reference.querySelector('.detail_wrap .header .card-hp.title')?.text.trim() !== card.name_ko) result.mismatches.push('Korean name reference');
      const shop = expected.rarity_source.match(/\/card\/([^/]+)\//)?.[1];
      const jp = parse((await cached(`https://yuyu-tei.jp/sell/poc/s/${shop}`, `yuyu-${shop}.html`)).toString('utf8'));
      const match = jp.querySelectorAll('img').find(img => img.getAttribute('alt')?.trim() === expected.rarity_title);
      if (!match) result.mismatches.push('Japanese number/name/rarity evidence');
      if (expected.image_source_url && match?.getAttribute('src')?.replace('/100_140/', '/front/') !== card._image_source_url) result.mismatches.push('Japanese illustration');
      const priceUrl = card.price_source?.match(/^fullahead:sale:(https:[^;]+)/)?.[1];
      if (priceUrl) {
        const priceHtml = parse(new TextDecoder('euc-jp').decode(await cached(priceUrl, `price-${card.card_num}.html`)));
        const title = priceHtml.querySelector('meta[property="og:title"]')?.getAttribute('content') || priceHtml.querySelector('title')?.text || '';
        const name = expected.name_jp.replace(/\(.+\)$/, '').replace(/\s/g, '');
        if (!title.replace(/\s/g, '').includes(name)) result.mismatches.push(`price name: ${title}`);
        const number = Number(title.match(/PK-[A-Z0-9+]+-(\d+)/i)?.[1]);
        if (number !== expected.jp_number) result.mismatches.push(`price number: ${title}`);
        result.priceEvidence = { url: priceUrl, title };
      }
      const url = card._image_source_url || (card.image_url.startsWith('http') ? card.image_url : `https://cards.image.pokemonkorea.co.kr/data/${card.image_url}`);
      const bytes = await cached(url, imageKey(code, card));
      const meta = await sharp(bytes).metadata();
      result.sourceImage = { url, width: meta.width, height: meta.height };
      result.imageKey = imageKey(code, card);
      if ((meta.width ?? 0) < 500) result.mismatches.push('source width below 500px');
    }
    return result;
  });
  writeFileSync(join(out, `${code}.json`), JSON.stringify(records, null, 2));
  const high = records.filter(r => r.sourceImage);
  const cols = 4, cellW = 260, cellH = 390;
  const layers = await mapLimit<any, any>(high, async (r, i) => ({
    input: await sharp(readFileSync(join(out, r.imageKey))).resize(250, 350, { fit: 'inside' }).extend({top: 0, bottom: 30, left: 0, right: 0, background: 'white'}).png().toBuffer(),
    left: (i % cols) * cellW, top: Math.floor(i / cols) * cellH,
  }));
  await sharp({ create: { width: cols * cellW, height: Math.ceil(high.length / cols) * cellH, channels: 3, background: '#dddddd' } }).composite(layers).jpeg({ quality: 90 }).toFile(join(out, `${code}-high.jpg`));
  mismatchCount += records.filter(r => r.mismatches.length).length;
  console.log(JSON.stringify({code, cards: records.length, official: records.filter(r=>r.official).length, mismatches: records.filter(r=>r.mismatches.length), high: high.map(r=>({n:r.number,name:r.name_ko,rarity:r.rarity,w:r.sourceImage.width,h:r.sourceImage.height}))}));
}
if (mismatchCount) process.exitCode = 1;
