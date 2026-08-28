#!/usr/bin/env tsx

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import bundleDefault from '../frontend/lib/bundle.ts';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data', 'sets');
const {
  resolveBundleSet,
  getBundleCardCount,
  getBundleComponentDisplayName,
  getBundleSummary,
} = bundleDefault as unknown as typeof import('../frontend/lib/bundle.ts');
const { simulateBundle } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');

const setCodeArg = process.argv.indexOf('--set');
const setCode = setCodeArg >= 0 ? process.argv[setCodeArg + 1] : 'm-magikarp-special-set';
const trialsArg = process.argv.indexOf('--trials');
const trials = trialsArg >= 0 ? Number.parseInt(process.argv[trialsArg + 1], 10) : 100;

function loadSet(code: string): SetMeta {
  return JSON.parse(readFileSync(join(DATA_DIR, `${code}.json`), 'utf8')) as SetMeta;
}

const rawBundle = loadSet(setCode);
assert.equal(rawBundle.type, 'bundle');
const sourceSets = (rawBundle.bundle_components ?? []).map((component) => loadSet(component.set_code));
const bundle = resolveBundleSet(rawBundle, sourceSets);
const expectedComposition = [
  { set_code: 'm-mega-brave', pack_count: 4 },
  { set_code: 'm-mega-symphonia', pack_count: 4 },
  { set_code: 'm-inferno-x', pack_count: 4 },
  { set_code: 'm-nihil-zero', pack_count: 4 },
  { set_code: 'm4-ninja-spinner', pack_count: 4 },
  { set_code: 'm5-abyss-eye', pack_count: 4 },
  { set_code: 'm-dream-ex', pack_count: 4 },
];

assert.equal(bundle.box_size, 28, '상품은 28팩이어야 합니다.');
assert.equal(getBundleCardCount(bundle), 160, '상품은 총 160장이어야 합니다.');
assert.equal(bundle.resolved_bundle_components?.length, 7, '구성 확장팩은 7종이어야 합니다.');
assert.ok(bundle.resolved_bundle_components?.every((component) => component.pack_count === 4));
assert.deepEqual(
  bundle.resolved_bundle_components?.map((component) => ({
    set_code: component.set.code,
    pack_count: component.pack_count,
  })),
  expectedComposition,
  '공식 동봉 팩 코드·순서·수량이 다릅니다.',
);
assert.deepEqual(getBundleSummary(bundle), {
  componentCount: 7,
  totalPacks: 28,
  totalCards: 160,
  uniformPackCount: 4,
});
assert.deepEqual(
  bundle.resolved_bundle_components?.map((component) => getBundleComponentDisplayName(component.set)),
  ['메가브레이브', '메가심포니아', '인페르노X', '니힐제로', '닌자스피너', '어비스아이', 'MEGA 드림 ex'],
  'UI용 동봉 팩 이름이 공식 구성과 다릅니다.',
);

for (let trial = 0; trial < trials; trial += 1) {
  const seed = `bundle-validation-${trial}`;
  const result = simulateBundle(bundle, seed);
  const replay = simulateBundle(bundle, seed);
  assert.deepEqual(result, replay, `${seed}: 같은 seed 결과가 달라졌습니다.`);
  assert.equal(result.packs.length, 28, `${seed}: 팩 수가 28이 아닙니다.`);
  assert.equal(result.packs.flatMap((pack) => pack.cards).length, 160, `${seed}: 카드 수가 160이 아닙니다.`);

  const counts = new Map<string, number>();
  for (const pack of result.packs) {
    assert.ok(pack.source_set_code, `${seed}: 원본 세트 provenance가 없습니다.`);
    counts.set(pack.source_set_code!, (counts.get(pack.source_set_code!) ?? 0) + 1);
    const source = sourceSets.find((set) => set.code === pack.source_set_code);
    assert.equal(pack.cards.length, source?.pack_size, `${seed}: ${pack.source_set_code} 팩 장수가 틀립니다.`);
    assert.ok(pack.cards.every((card) => card.source_set_code === pack.source_set_code));
  }
  for (const source of sourceSets) assert.equal(counts.get(source.code), 4, `${seed}: ${source.code}가 4팩이 아닙니다.`);
}

console.log(`${setCode}: ${trials}회 검증 통과 (7종×4팩=28팩, 총160장, seed 재현)`);
