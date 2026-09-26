/** Reviewed Korean replacements: metadata, saved-history aliases, and optional live CDN pixels. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import simulatorDefault from '../frontend/lib/simulator.ts';
import imagesDefault from '../frontend/lib/images.ts';
import type { Card } from '../frontend/lib/types.ts';
const { simulateBox, simulatePack } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const { resolveCardImageUrl } = imagesDefault as unknown as typeof import('../frontend/lib/images.ts');

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'));
const review = read('data/manual/korean-image-review-20260926.json');
const aliases = read('frontend/lib/card-image-replacements.json');
const prices = read('data/prices/price-matches.json').cards;
const network = process.argv.includes('--cdn');
const out = join(root, '.tmp/korean-image-validation-20260926');
mkdirSync(out, { recursive: true });
const results: object[] = [];
const thumbnails: { input: Buffer; left: number; top: number }[] = [];
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
async function download(url: string) {
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert(response.ok, `${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch(error) { if(attempt===2)throw error; }
  }
  throw Error('Unreachable');
}
async function pixels(bytes: Buffer) {
  return sharp(bytes).flatten({background:'#fff'}).resize(64,88,{fit:'fill'}).removeAlpha().raw().toBuffer();
}
async function main() {
  assert.equal(review.cards.length, 93);
  const seen = new Set<string>();
  for (const row of review.cards) {
    const set = read(`data/sets/${row.set}.json`);
    assert.deepEqual(set, read(`frontend/public/sets/${row.set}.json`));
    const card = set.cards.find((c: any) => c.card_num === row.id);
    assert.deepEqual(card, row.after, row.id);
    assert.equal(card.card_num, row.before.card_num, 'Persistent record ID must not change');
    assert.equal(card.rarity, row.before.rarity);
    assert.equal(card._image_language, 'ko');
    assert.equal(aliases[row.before.image_url], card.image_url);
    for(const size of [undefined,256,512] as const) {
      assert.equal(resolveCardImageUrl(row.before.image_url,{size}),resolveCardImageUrl(card.image_url,{size}));
      assert(resolveCardImageUrl(card.image_url,{size}).includes('/ko-20260926/'));
    }
    if(card._jp_number) assert.equal(prices[card.card_num].fullahead_number, card._jp_number);
    assert(!seen.has(card.image_url), 'Duplicate image key');
    seen.add(card.image_url);
  }
  for (const code of [...new Set<string>(review.cards.map((r: any) => r.set))]) {
    const set = read(`data/sets/${code}.json`);
    const before = set.cards.map((card: any) => review.cards.find((r: any) => r.set === code && r.id === card.card_num)?.before ?? card)
      .sort((a: any,b: any)=>a.number-b.number);
    const counts = (cards: Card[]) => cards.reduce((acc: Record<string,number>,card)=>{const key=card.rarity??'null';acc[key]=(acc[key]??0)+1;return acc;},{});
    const reached = new Set<string>();
    for(let i=0;i<1000;i++) {
      const args = [set.box_size,set.type,set.pack_size,`kr-image-box-${i}`,code] as const;
      const oldBox = simulateBox(before,...args), newBox = simulateBox(set.cards,...args);
      assert.deepEqual(counts(oldBox.packs.flatMap(p=>p.cards)),counts(newBox.packs.flatMap(p=>p.cards)),`${code}: image edit changed rarity counts`);
      for(const pack of newBox.packs) { assert.equal(pack.cards.length,set.pack_size);pack.cards.forEach(card=>reached.add(card.card_num)); }
    }
    for(let i=0;i<10000;i++) {
      const args = [set.type,set.pack_size,`kr-image-pack-${i}`,code] as const;
      const oldPack = simulatePack(before,...args), newPack = simulatePack(set.cards,...args);
      assert.deepEqual(counts(oldPack.pack.cards),counts(newPack.pack.cards),`${code}: image edit changed pack rarity counts`);
      assert.equal(newPack.pack.cards.length,set.pack_size);
      newPack.pack.cards.forEach(card=>reached.add(card.card_num));
    }
    const changed = review.cards.filter((r: any)=>r.set===code);
    assert(changed.every((r: any)=>reached.has(r.id)),`${code}: changed card unreachable`);
    console.log(`${code}: 1000 boxes + 10000 packs unchanged rarity counts; all replacement cards reached`);
  }
  if(network) {
    let cursor = 0;
    await Promise.all(Array.from({length:4}, async () => {
      while(cursor < review.cards.length) {
        const index = cursor++;
        const row = review.cards[index], card = row.after;
        let source = await download(card._image_source_url);
        if(card._image_crop) source = await sharp(source).extract(card._image_crop).toBuffer();
        const sourceMeta = await sharp(source).metadata();
        assert(sourceMeta.width && sourceMeta.height, `${row.id}: invalid source metadata`);
        const base = await pixels(source);
        const variants = [];
        for(const size of [256,512]) {
          const key = `cards/${size}/${card.image_url.replace(/\.[^.]+$/,'.webp')}`;
          const bytes = await download(`https://img.pokesim.kr/${key}`);
          const meta = await sharp(bytes).metadata();
          assert.equal(meta.width,size);
          assert.equal(meta.format,'webp');
          const actual = await pixels(bytes);
          const difference = base.reduce((sum,v,i)=>sum+Math.abs(v-actual[i]),0)/base.length;
          assert(difference<12,`${row.id}: wrong ${size} image (${difference})`);
          variants.push({size,bytes:bytes.length,sha256:sha(bytes),difference});
        }
        results.push({set:row.set,id:row.id,key:card.image_url,width:sourceMeta.width,height:sourceMeta.height,source_sha256:sha(source),variants});
        const label = Buffer.from(`<svg width="144" height="20"><rect width="144" height="20" fill="white"/><text x="2" y="14" font-size="11">${row.set.split('-')[0]} ${card.number} ${card.rarity}</text></svg>`);
        const thumb = await sharp(source).resize(140,196,{fit:'contain',background:'#fff'}).png().toBuffer();
        const panel = await sharp({create:{width:144,height:220,channels:3,background:'#fff'}}).composite([{input:label,left:0,top:0},{input:thumb,left:2,top:22}]).png().toBuffer();
        thumbnails[index] = {input:panel,left:(index%6)*144,top:Math.floor((index%30)/6)*220};
        console.log(`CDN OK ${row.set} ${card.number}: 256 + 512`);
      }
    }));
    writeFileSync(join(out,'cdn.json'),JSON.stringify(results,null,2)+'\n');
    for(let i=0;i<thumbnails.length;i+=30) {
      await sharp({create:{width:864,height:Math.ceil(Math.min(30,thumbnails.length-i)/6)*220,channels:3,background:'#fff'}}).composite(thumbnails.slice(i,i+30)).jpeg({quality:92}).toFile(join(out,`review-${i/30}.jpg`));
    }
  }
  console.log(`PASS: 93 metadata snapshots + history aliases${network ? ', 186 WebP variants' : ''}`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
