/** Export compact, checked-in evidence from the completed cached image audit. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const codes: string[] = read('data/sets-index.json').active_sets;
const rows: any[] = [];
const sets = codes.map(code => {
  const set = read(`data/sets/${code}.json`);
  const result = read(`.tmp/card-identity-audit/${code}-images.json`);
  if (set.cards.length !== result.length || result.some((r: any, i: number) => r.id !== set.cards[i].card_num || r.name !== set.cards[i].name_ko)) {
    throw new Error(`Stale report: ${code}`);
  }
  rows.push(...result);
  return { code, cards: result.length, sha256: createHash('sha256').update(JSON.stringify(set)).digest('hex') };
});
const findings = rows.flatMap(r => r.findings);
const report = {
  reviewed_at: '2026-09-10', scope: 'active_sets; card entries include mirrors and repeated products',
  method: 'Official Korean detail metadata + source/CDN 32x44 RGB mean difference (threshold 12); not OCR or exhaustive visual proof.',
  summary: {
    products: sets.length, cards: rows.length,
    official_metadata_available: rows.filter(r => r.official).length,
    cdn_256_decoded: rows.filter(r => r.variant_256).length,
    cdn_512_decoded: rows.filter(r => r.variant_512).length,
    source_compared: rows.filter(r => r.variant_512?.difference != null).length,
    findings: findings.reduce((a: any, f: any) => ({ ...a, [f.field]: (a[f.field] ?? 0) + 1 }), {}),
  },
  manually_reviewed: [{ card_num: 'BS2026004112', result: 'Same Japanese Mega Zeraora ex 112/081 SAR art; photographed versus scanned border/colour difference, not wrong identity.' }],
  limitations: [
    'Missing official details and non-official IDs are unverified, not passed.',
    'Source 404 prevents independent pixel comparison even when CDN variants decode.',
    'Direct external image URLs have no CDN variants and are listed for migration.',
    'CDN original URLs returned HTTP 403 in sampled checks; this run checks variants, not CDN originals.',
    'No global Japanese product-name/price correctness certification; only reviewed KR/JP numbering maps were repaired.',
  ],
  sets,
  exceptions: rows.filter(r => r.findings.length).map(r => ({ set: r.set, card_num: r.id, number: r.number, name: r.name, source: r.official?.source ?? null, findings: r.findings })),
};
writeFileSync(join(root, 'data/manual/card-identity-audit-20260910.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
