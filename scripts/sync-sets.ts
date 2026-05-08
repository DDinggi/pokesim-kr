#!/usr/bin/env tsx
/**
 * data/sets/*.json → frontend/public/sets/*.json 동기화
 *
 * 사용:
 *   pnpm sync
 *   pnpm sync -- --dry-run
 *   pnpm sync -- --set sv9-battle-partners   (특정 세트만)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SRC_DIR = join(REPO_ROOT, 'data', 'sets');
const DST_DIR = join(REPO_ROOT, 'frontend', 'public', 'sets');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const targetSet = (() => {
  const i = argv.indexOf('--set');
  return i !== -1 ? argv[i + 1] : null;
})();

const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'));

let synced = 0;
let skipped = 0;

for (const file of files) {
  if (targetSet && file !== `${targetSet}.json`) continue;

  const src = join(SRC_DIR, file);
  const dst = join(DST_DIR, file);

  const srcContent = readFileSync(src, 'utf8');

  // 변경 없으면 스킵
  let dstContent = '';
  try { dstContent = readFileSync(dst, 'utf8'); } catch { /* 신규 파일 */ }
  if (srcContent === dstContent) {
    console.log(`  skip  ${file}`);
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`  [dry] ${file} → would update`);
  } else {
    writeFileSync(dst, srcContent, 'utf8');
    console.log(`  sync  ${file}`);
  }
  synced++;
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}완료: ${synced}개 동기화, ${skipped}개 스킵`);
