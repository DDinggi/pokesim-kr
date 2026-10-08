import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'node-html-parser';

type JpCard = { number: number; name: string; rarity: string | null; image: string; url: string; price: number };
type Card = { number: number | null; card_num: string; name_ko: string; rarity: string | null; image_url: string; subtype?: string; _image_source_url?: string; _source?: string; _jp_number?: number };
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const arg = (key: string) => args[args.indexOf(key) + 1];
const codes = args.includes('--set') ? arg('--set').split(',') : [];
if (!codes.length) throw new Error('Usage: pnpm audit:comparison -- --set code[,code] [--refresh] [--output path]');
const directory = resolve(root, args.includes('--output') ? arg('--output') : '.tmp/card-comparison');
mkdirSync(directory, { recursive: true });
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const origin = 'https://pokemon-card-fullahead.com';
async function fetchHtml(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokeSimKR/1.0)', 'Accept-Language': 'ja' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return new TextDecoder('euc-jp').decode(await response.arrayBuffer());
}
async function catalog(shop: string): Promise<JpCard[]> {
  const category = shop.replace(/^([a-z]+)(\d)([a-z]*)$/, '$10$2$3');
  const pattern = shop.toUpperCase().replace(/PLUS$/, '(?:PLUS|\\+)');
  const numberPattern = new RegExp(`PK-${pattern}-(\\d{1,3})(?![\\d-])\\s+(.+)`, 'i');
  const byNumber = new Map<number, JpCard>();
  for (let page = 1; page <= 30; page++) {
    const pageUrl = `${origin}/shopbrand/${category}/${page === 1 ? '' : `page${page}/recommend/`}`;
    const document = parse(await fetchHtml(pageUrl));
    let matched = 0;
    for (const node of document.querySelectorAll('span.itemName')) {
      const match = node.text.trim().match(numberPattern);
      if (!match) continue; // Do not expand bundled ranges into fake individual images.
      matched++;
      const anchor = node.parentNode!;
      const image = anchor.querySelector('img')?.getAttribute('src');
      const href = anchor.getAttribute('href');
      if (!image || !href) continue;
      const number = Number(match[1]);
      const rarity = match[2].match(/\b(HR|UR|SR|RR|R|U|C)\b/)?.[1] ?? null;
      const price = Number((anchor.parentNode?.querySelector('span.itemPrice strong')?.text ?? '').replace(/\D/g, ''));
      const item = { number, name: match[2].trim(), rarity, image, url: new URL(href, origin).href, price };
      const previous = byNumber.get(number);
      if (!previous || price > previous.price) byNumber.set(number, item);
    }
    if (!matched) break;
  }
  if (!byNumber.size) throw new Error(`${shop}: no matching Japanese singles (wrong category/fallback rejected)`);
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

const sections: string[] = [];
for (const code of codes) {
  const set = JSON.parse(readFileSync(join(root, 'data/sets', `${code}.json`), 'utf8'));
  const cache = join(directory, `${code}.jp.json`);
  const items: JpCard[] = existsSync(cache) && !args.includes('--refresh') ? JSON.parse(readFileSync(cache, 'utf8')) : await catalog(set.fullahead_shop_code);
  writeFileSync(cache, `${JSON.stringify(items, null, 2)}\n`);
  const jp = new Map(items.map(card => [card.number, card]));
  const cards: Card[] = set.cards;
  const numbers = new Set(cards.map(card => card._jp_number ?? card.number));
  const missing = items.filter(card => !numbers.has(card.number));
  const disagreements = cards.filter(card => jp.get(card._jp_number ?? card.number ?? -1)?.rarity && card.rarity !== jp.get(card._jp_number ?? card.number ?? -1)!.rarity);
  console.log(`${code}: entries=${cards.length}, Japanese singles=${items.length}, missing=${missing.map(c => `#${c.number} ${c.name}`).join('; ') || 'none'}, rarity differences=${disagreements.map(c => `KR#${c.number}/JP#${c._jp_number ?? c.number} ${c.rarity}->${jp.get(c._jp_number ?? c.number!)?.rarity}`).join(',') || 'none'}`);
  const rows: Array<{ card?: Card; item?: JpCard; number: number | null }> = cards.map(card => ({ card, item: jp.get(card._jp_number ?? card.number ?? -1), number: card.number }));
  rows.push(...missing.map(item => ({ item, number: item.number })));
  rows.sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
  sections.push(`<section id="${escape(code)}"><h2>${escape(set.name_ko)}</h2><div class="headers"><h3>한국판 · 왼쪽</h3><h3>일본판 · 오른쪽</h3></div>${rows.map(({ card, item, number }) => {
    const mismatch = card && item?.rarity && card.rarity !== item.rarity;
    const hasKoreanImage = card?.image_url.startsWith('wmimages/');
    const krOriginal = hasKoreanImage ? `https://img.pokesim.kr/${card!.image_url}` : undefined;
    const krImage = hasKoreanImage ? `https://img.pokesim.kr/cards/512/${card!.image_url.replace(/\.[^.]+$/, '.webp')}` : undefined;
    const cell = (title: string, source: string | undefined, image: string | undefined, info: string, original = image) => `<article><h4>${escape(title)}</h4><p>${escape(info)}</p>${image ? `<a href="${escape(original)}" target="_blank" rel="noopener"><img src="${escape(image)}" loading="lazy" decoding="async" alt="${escape(title)}"></a>` : '<div class="missing">한국판/개별 이미지 미확보</div>'}${source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener">근거 페이지</a></p>` : ''}</article>`;
    const high = [card?.rarity, item?.rarity].some(rarity => ['SR', 'HR', 'UR', 'AR', 'SAR', 'MUR', 'BWR', 'FUR', 'RGB'].includes(rarity ?? ''));
    const krNumberLabel = hasKoreanImage ? `KR #${number ?? '에너지'}` : `JP 기준 #${number ?? '미확인'} (한국 번호 미확인)`;
    return `<div class="pair ${mismatch ? 'warn' : ''}" data-high="${high}" data-search="${escape(`${card?.name_ko ?? ''} ${item?.name ?? ''} ${number ?? ''} ${item?.number ?? ''}`)}">${cell(card?.name_ko ?? '한국 목록에 없음', hasKoreanImage ? (card?._source ?? `https://pokemoncard.co.kr/cards/detail/${card!.card_num}`) : card?._source, krImage, `${krNumberLabel} · ${card?.rarity ?? '등급 없음'} · ${card?.subtype ?? ''} · ${card?.card_num ?? ''}${card && !hasKoreanImage ? ' · 한국판 이미지 미확보: 서비스는 일본판 보강 사용' : ''}`, krOriginal)}${cell(item?.name ?? '일본 개별 이미지 미확보', item?.url, item?.image, `JP #${item?.number ?? '미대응'} · ${item?.rarity ?? '등급 토큰 없음'}${mismatch ? ' · 등급 대조 필요' : ''}`)}</div>`;
  }).join('')}</section>`);
}
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>한국·일본 카드 번호별 대조</title><style>body{font:15px system-ui;margin:0;background:#10141b;color:#e5e7eb}main{max-width:1000px;margin:auto;padding:24px}nav{display:flex;gap:12px;flex-wrap:wrap}a{color:#7dd3fc}section{margin-top:40px}.headers,.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.headers{position:sticky;top:0;background:#10141b;z-index:1;text-align:center}.pair{border-bottom:1px solid #374151;padding:16px 0}.pair[hidden]{display:none}.warn{background:#482c12}article{text-align:center;min-width:0}h4,p{margin:8px 0}img{width:100%;max-width:320px;height:auto;aspect-ratio:5/7;object-fit:contain}.missing{height:300px;display:grid;place-items:center;background:#242a34}input[type=search]{margin:12px;padding:10px;max-width:65%}</style><main><h1>한국판 ↔ 일본판 카드 대조</h1><p>한국판 인쇄 번호순으로 같은 카드의 한국판은 왼쪽, 일본판은 오른쪽에 배치했습니다. 서로 다른 번호는 KR/JP로 각각 표시합니다. 미러는 별도 행이며 묶음 판매 이미지를 개별 카드로 사용하지 않습니다. 한국판 미확보를 일본 이미지로 위장하지 않습니다. 한국 이미지는 512 WebP로 표시하고 누르면 R2 원본을 엽니다.</p><label><input id="high" type="checkbox"> 고레어만 보기</label><input id="search" type="search" placeholder="카드 이름 또는 번호 검색" aria-label="카드 검색"><nav>${codes.map(code => `<a href="#${escape(code)}">${escape(code)}</a>`).join('')}</nav>${sections.join('')}</main><script>const high=document.getElementById('high'),search=document.getElementById('search');function filter(){const q=search.value.trim().toLowerCase();document.querySelectorAll('.pair').forEach(row=>row.hidden=(high.checked&&row.dataset.high!=='true')||!row.dataset.search.toLowerCase().includes(q));}high.addEventListener('change',filter);search.addEventListener('input',filter);</script></html>`;
writeFileSync(join(directory, 'index.html'), html);
console.log(`Comparison: ${join(directory, 'index.html')}`);
