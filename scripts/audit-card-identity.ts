/** Read-only identity audit. Cached HTTP evidence and reports live in .tmp.
 * --set CODE limits scope; --images checks CDN original/256/512 against source.
 * This command never patches card data or uploads assets.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'node-html-parser';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const cacheIndex = process.argv.indexOf('--cache-dir');
const out = cacheIndex < 0 ? join(root, '.tmp/card-identity-audit') : resolve(root, process.argv[cacheIndex + 1]);
mkdirSync(out, { recursive: true });
const argv = process.argv.slice(2);
const arg = (key: string) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : undefined;
const selected = arg('--set');
const selectedCards = new Set((arg('--cards') ?? '').split(',').filter(Boolean));
const imageMode = argv.includes('--images');
const variantsOnly = argv.includes('--variants-only');
const concurrency = Number(arg('--concurrency') ?? 6);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('concurrency must be 1..12');
const index = JSON.parse(readFileSync(join(root, 'data/sets-index.json'), 'utf8'));
const codes: string[] = selected ? [selected] : index.active_sets;
const sourceBase = 'https://cards.image.pokemonkorea.co.kr/data/';
const cdn = 'https://img.pokesim.kr/';
const normalize = (s: unknown) => String(s ?? '').normalize('NFKC').replace(/_x000D_/gi, '').replace(/\s+/g, '').trim();
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const pending = new Map<string, Promise<Buffer>>();
async function cached(url: string): Promise<Buffer> {
  if (pending.has(url)) return pending.get(url)!;
  const task = (async () => {
    const path = join(out, hash(url));
    if (existsSync(path)) return readFileSync(path);
    for (let retry = 0; retry < 3; retry++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${url}`);
          if ([403, 404, 410].includes(response.status)) (error as any).permanent = true;
          throw error;
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        writeFileSync(path, bytes);
        return bytes;
      } catch (e) {
        if (retry === 2 || (e as any).permanent) throw e;
        await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
      }
    }
    throw new Error('unreachable');
  })();
  pending.set(url, task);
  try { return await task; } finally { pending.delete(url); }
}
async function pixels(bytes: Buffer) {
  return sharp(bytes).flatten({ background: '#fff' }).resize(32, 44, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}
const distance = (a: Buffer, b: Buffer) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
async function audit(set: any, card: any) {
  const result: any = { set: set.code, id: card.card_num, number: card.number, name: card.name_ko, findings: [] };
  const officialId = card._official_card_num ?? card.card_num;
  const officialUrl = /^BS\d+m?$/.test(officialId) ? `https://pokemoncard.co.kr/cards/detail/${officialId}` : null;
  let officialImage: string | undefined;
  if (officialUrl) {
    try {
      const html = parse((await cached(officialUrl)).toString('utf8'));
      const name = html.querySelector('.detail_wrap .header .card-hp.title')?.text.trim();
      const number = Number(html.querySelector('.p_num')?.text.replace(/\s+/g, '').match(/(\d+)\//)?.[1]);
      const text = html.querySelector('#no_wrap_by_admin')?.text ?? '';
      const rarity = text.match(/\b(?:MUR|SSR|SAR|CSR|RRR|CHR|BWR|GRA|ACE|SR|HR|UR|RR|AR|TR|MA|PR|C|U|R|S|A|K)\b/)?.[0]
        ?? (html.querySelector('#no_wrap_by_admin img[title="빛"]') ? 'H' : null);
      const hp = Number(html.querySelector('.hp_num')?.text.replace(/\D/g, '')) || null;
      const info = html.querySelector('.pokemon-info')?.text ?? '';
      const card_type = /지지자|서포트|도구|스타디움|트레이너|아이템/.test(info) ? '트레이너'
        : info.includes('에너지') ? '에너지' : info.includes('포켓몬') ? '포켓몬' : null;
      const type = html.querySelectorAll('.detail_wrap .header img.type_b').find(n => n.getAttribute('title'))?.getAttribute('title') ?? null;
      officialImage = html.querySelector('.feature_image')?.getAttribute('src');
      if (!name || !officialImage) throw new Error('Official detail missing name/image');
      if (officialImage.startsWith('//')) officialImage = `https:${officialImage}`;
      result.official = { name_ko: name, number: number || null, rarity, hp, type, card_type, image: officialImage, source: officialUrl };
      for (const [key, actual] of Object.entries({ name_ko: name, number: number || null, hp, type, card_type })) {
        if (actual != null && normalize(card[key]) !== normalize(actual)) result.findings.push({ field: key, local: card[key], official: actual });
      }
      if (rarity && rarity !== card.rarity && !(rarity === 'MUR' && card.rarity === 'UR')) result.findings.push({ field: 'rarity', local: card.rarity, official: rarity });
      if (card.image_url?.startsWith('wmimages/') && officialImage.replace(sourceBase, '').split('?')[0] !== card.image_url) {
        result.findings.push({ field: 'image_path', local: card.image_url, official: officialImage });
      }
    } catch (e) { result.findings.push({ field: 'official_unavailable', error: String(e) }); }
  } else result.findings.push({ field: 'non_official_id', source: card._source });
  if (imageMode) {
    // Explicit source handles manually split composites and Japanese fallback assets.
    const source = card._image_source_url || (card.image_url?.startsWith('wmimages/') ? officialImage : null);
    result.imageSource = source ?? null;
    const key = card.image_url;
    if (/^https?:/.test(key)) result.findings.push({ field: 'external_image_url', url: key });
    let base: Buffer | undefined;
    if (source && !card._image_crop && !card._image_quadrant) {
      try { base = await pixels(await cached(source)); }
      catch (e) { result.findings.push({ field: 'image_source_unavailable', error: String(e) }); }
    } else result.findings.push({ field: 'image_identity_needs_review' });
    if (!variantsOnly || /^https?:/.test(key)) try {
      const original = await cached(/^https?:/.test(key) ? key : cdn + key);
      const originalPixels = await pixels(original);
      result.image = { originalHash: hash(original), ...(await sharp(original).metadata()) };
      if (base) {
        const diff = distance(originalPixels, base);
        result.sourceDifference = diff;
        if (diff > 12) result.findings.push({ field: 'source_image_difference', difference: diff });
      }
      base ??= originalPixels;
    } catch (e) { result.findings.push({ field: 'original_image_unavailable', error: String(e) }); }
    if (!/^https?:/.test(key)) for (const size of [256, 512]) {
        try {
          const bytes = await cached(`${cdn}cards/${size}/${key.replace(/\.[a-z0-9]+$/i, '')}.webp`);
          const variantPixels = await pixels(bytes);
          const diff = base ? distance(base, variantPixels) : null;
          if (diff != null && diff > 12) result.findings.push({ field: `variant_${size}_difference`, difference: diff });
          result[`variant_${size}`] = { hash: hash(bytes), difference: diff };
        } catch (e) { result.findings.push({ field: `variant_${size}_unavailable`, error: String(e) }); }
      }
  }
  return result;
}
let total = 0;
for (const code of codes) {
  const set = JSON.parse(readFileSync(join(root, `data/sets/${code}.json`), 'utf8'));
  if (selectedCards.size) set.cards = set.cards.filter((card: any) => selectedCards.has(card.card_num));
  const results: any[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < set.cards.length) {
      const i = cursor++;
      results[i] = await audit(set, set.cards[i]);
    }
  }));
  total += results.length;
  writeFileSync(join(out, `${code}${imageMode ? '-images' : ''}.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ set: code, cards: results.length, flagged: results.filter(r => r.findings.length).length, total,
    fields: results.flatMap(r => r.findings).reduce((a, f) => ({ ...a, [f.field]: (a[f.field] ?? 0) + 1 }), {}) }));
}
