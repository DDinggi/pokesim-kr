/** Reviewed official classification fixes; dry-run unless --write. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const write = process.argv.includes('--write');
const codes: string[] = JSON.parse(readFileSync(join(root, 'data/sets-index.json'), 'utf8')).active_sets;
const review: unknown[] = [];
const slots: Record<string, { rarity: string; min: number; max: number; source: string; note: string }> = {
  'sv4a-shiny-treasure-ex': { rarity: 'S', min: 3, max: 3,
    source: 'https://pokemon-infomation.com/pull-rates-shinytreasure/; https://ameblo.jp/schweizer04/entry-12831011143.html',
    note: '일본판 공개 개봉 정리의 S 약 3장을 고정 3장으로 근사. 재판 구분 불명.' },
  'sv8a-terastal-festa': { rarity: 'ACE', min: 1, max: 1,
    source: 'https://cuberoomblog.com/pokeca-terafes-boxopen/', note: '일본 발매 시점 개봉 종합 및 2BOX 기록: ACE 1장.' },
  's4a-shiny-star-v': { rarity: 'A', min: 1, max: 2,
    source: 'https://shark-tcg.com/s4a-box-kaihu/', note: '일본판 A 1~2장 범위의 중간값: 1장+50% 추가. 50%는 실측치가 아니라 근사. 재판 구분 불명.' },
  'sm12a-tag-team-gx-tag-all-stars': { rarity: 'PR', min: 0, max: 1,
    source: 'https://castle-gaming.com/pokeca-tagall-kaihu/', note: '일본 발매 시점 개봉 종합: 일반 박스 PR 1장. SR10 특수팩 박스는 제외한다.' },
};
for (const code of codes) {
  const file = join(root, `data/sets/${code}.json`);
  const set = JSON.parse(readFileSync(file, 'utf8'));
  const rows = JSON.parse(readFileSync(join(root, `.tmp/card-identity-audit/${code}.json`), 'utf8'));
  let changed = 0;
  for (const row of rows) {
    const card = set.cards.find((c: any) => c.card_num === row.id);
    const fields = row.findings.filter((f: any) => ['card_type', 'rarity'].includes(f.field) && card[f.field] !== f.official);
    if (!fields.length) continue;
    if (row.official?.number !== card.number) throw new Error(`Number mismatch: ${row.id}`);
    const before = structuredClone(card);
    for (const f of fields) {
      if (f.field === 'rarity' && slots[code]?.rarity !== f.official) throw new Error(`Unreviewed rarity: ${row.id}`);
      if (f.field === 'card_type' && !['트레이너', '포켓몬'].includes(f.official)) throw new Error(`Unreviewed type: ${row.id}`);
      card[f.field] = f.official;
    }
    card._classification_review = { date: '2026-09-10', source: row.official.source };
    review.push({ set: code, card_num: row.id, before, after: card });
    changed++;
  }
  if (changed && slots[code]) {
    const slot = slots[code];
    if (!set.rarities.includes(slot.rarity)) set.rarities.push(slot.rarity);
    set.box_guarantees.rules = set.box_guarantees.rules.filter((r: any) => r.rarity !== slot.rarity);
    set.box_guarantees.rules.push({ rarity: slot.rarity, min: slot.min, max: slot.max });
    // Preserve earlier evidence, but supersede the old claim that null S is still in the base pool.
    set.box_guarantees._source = set.box_guarantees._source.replace(/S\(샤이니 일반\)[^.]*\./, '')
      + ` 2026-09-10 분류 복구: ${slot.note} 한국판 공식 봉입률은 비공개. 출처: ${slot.source}`;
    set.box_guarantees.classification_review = { reviewed_at: '2026-09-10', source: slot.source, note: slot.note, _sample_size: null };
  }
  if (write && changed) {
    const json = JSON.stringify(set, null, 2) + '\n';
    writeFileSync(file, json);
    writeFileSync(join(root, `frontend/public/sets/${code}.json`), json);
  }
  if (changed) console.log(`${code}: ${changed} ${write ? 'applied' : 'dry-run'}`);
}
if (write && review.length) writeFileSync(join(root, 'data/manual/card-classification-review-20260910.json'), JSON.stringify(review, null, 2) + '\n');
console.log(`Reviewed cards: ${review.length}`);
