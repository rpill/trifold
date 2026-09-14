import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeal } from '../src/game/model/deal.ts';
import { solverOutputPath } from '../tools/deals/build-solver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('C++ deal construction matches production TypeScript for frozen seeds', () => {
  const solver = solverOutputPath();
  for (const seed of [1, 2, 7, 123456789, 4294967295]) {
    const stdout = execFileSync(solver, ['--seed', String(seed), '--deal-json'], { cwd: ROOT, encoding: 'utf8' });
    const record = JSON.parse(stdout);
    assert.equal(record.seed, seed);
    assert.deepEqual(record.tableau, createDeal(seed).tableau, `seed ${seed}`);
  }
});
