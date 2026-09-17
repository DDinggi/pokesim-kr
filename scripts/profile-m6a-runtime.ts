import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import luckDefault from '../frontend/lib/luck.ts';
import simulatorDefault from '../frontend/lib/simulator.ts';
import type { SetMeta } from '../frontend/lib/types.ts';

const luck = luckDefault as unknown as typeof import('../frontend/lib/luck.ts');
const { simulateBox } = simulatorDefault as unknown as typeof import('../frontend/lib/simulator.ts');
const set = JSON.parse(readFileSync(resolve(import.meta.dirname, '../data/sets/m6a-30th-celebration.json'), 'utf8')) as SetMeta;
const count = Number(process.argv[2] ?? 10);
const summaries = [];
const moments = (outcomes: Array<{ score: number; probability: number }>) => {
  const mass = outcomes.reduce((sum, item) => sum + item.probability, 0);
  const mean = outcomes.reduce((sum, item) => sum + item.score * item.probability, 0);
  const variance = outcomes.reduce((sum, item) => sum + (item.score - mean) ** 2 * item.probability, 0);
  return { mass, mean, variance };
};
let expectedMean = 0;
let expectedVariance = 0;
for (let i = 0; i < count; i++) {
  const started = performance.now();
  const box = simulateBox(set.cards, 20, set.type, 6, `profile-${i}`, set.code);
  const opening = luck.createLuckOpening(set, { boxes: 1 });
  summaries.push(luck.summarizeLuckEvent(box.packs.flatMap((p) => p.cards), opening, set));
  const current = moments(summaries.at(-1)!.scoreDistribution!);
  expectedMean += current.mean;
  expectedVariance += current.variance;
  const summaryMs = performance.now() - started;
  console.log(`box ${i + 1}: simulate+summary=${summaryMs.toFixed(2)}ms; starting accumulated score`);
  const aggregateStart = performance.now();
  const result = luck.scoreLuckSummaries(summaries);
  console.log(`  aggregate=${(performance.now() - aggregateStart).toFixed(2)}ms states=${result?.scoreDistribution?.length}`);
  const outcomes = result!.scoreDistribution!;
  const combined = moments(outcomes);
  assert.ok(Math.abs(combined.mass - 1) < 1e-9, 'Probability mass changed');
  assert.ok(Math.abs(combined.mean - expectedMean) < 1e-7, 'Convolution mean changed');
  assert.ok(Math.abs(combined.variance - expectedVariance) < 1e-7, 'Convolution variance changed');
  for (let j = 1; j < outcomes.length; j++) assert.ok(outcomes[j].score - outcomes[j - 1].score >= 5e-10, 'Near-duplicate score states');
}
