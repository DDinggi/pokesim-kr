/** Apply the reviewed 2026-09-09 identity fixes; cached audit evidence required.
 * Dry-run by default. --write updates source/public JSON and a review manifest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const write = process.argv.includes('--write');
const review: any[] = [];
const priceKeys = ['price_ref_krw', 'price_ref_jpy', 'price_ref_usd', 'price_source', 'price_updated_at', 'price_confidence'];
const imageKeys = ['image_url', '_image_source_url'];
const abyssJpForKr: Record<number, number> = { 102: 105, 103: 102, 104: 103, 105: 104, 106: 107, 107: 106, 108: 109, 109: 110, 110: 111, 111: 108 };
const shinyJpForKr: Record<number, number> = { 191: 194, 192: 199, 193: 198, 194: 191, 195: 196, 196: 193, 197: 192, 198: 197, 199: 195 };
for (const code of ['s10p-space-juggler', 's4a-shiny-star-v', 'm5-abyss-eye', 'm4-ninja-spinner']) {
  const file = join(root, `data/sets/${code}.json`);
  const set = JSON.parse(readFileSync(file, 'utf8'));
  const original = new Map<number, any>(set.cards.map((c: any) => [c.number, structuredClone(c)]));
  const audit = JSON.parse(readFileSync(join(root, `.tmp/card-identity-audit/${code}.json`), 'utf8'));
  let changed = 0;
  for (const row of audit) {
    const fields = row.findings.filter((f: any) => ['name_ko', 'hp', 'type'].includes(f.field));
    if (!fields.length) continue;
    const card = set.cards.find((c: any) => c.card_num === row.id);
    if (card._identity_review?.date === '2026-09-09') continue;
    if (!row.official || card.number !== row.official.number) throw new Error(`Unreviewed numbering: ${row.id}`);
    const before = structuredClone(card);
    const jpNumber = code === 'm5-abyss-eye' ? abyssJpForKr[card.number] : code === 's4a-shiny-star-v' ? shinyJpForKr[card.number] : undefined;
    if (jpNumber) {
      const mapped = original.get(jpNumber);
      if (!mapped) throw new Error(`Missing JP counterpart: ${code} ${jpNumber}`);
      for (const field of [...priceKeys, ...(code === 'm5-abyss-eye' ? imageKeys : [])]) {
        if (mapped[field] === undefined) delete card[field]; else card[field] = mapped[field];
      }
      card._jp_number = jpNumber;
    }
    for (const field of fields) card[field.field] = field.official;
    card._identity_review = { date: '2026-09-09', source: row.official.source, jp_number: jpNumber ?? null };
    review.push({ set: code, card_num: row.id, source: row.official.source, before, after: card });
    changed++;
  }
  if (write && changed) {
    const text = JSON.stringify(set, null, 2) + '\n';
    writeFileSync(file, text);
    writeFileSync(join(root, `frontend/public/sets/${code}.json`), text);
  }
  console.log(`${code}: ${changed} reviewed corrections ${write ? 'applied' : '(dry-run)'}`);
}
if (write && review.length) writeFileSync(join(root, 'data/manual/card-identity-review-20260909.json'), JSON.stringify(review, null, 2) + '\n');
