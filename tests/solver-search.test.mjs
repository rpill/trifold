import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solverOutputPath } from '../tools/deals/build-solver.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('solver bounds pathological decision paths instead of overflowing the native stack', () => {
  const result = spawnSync(
    solverOutputPath(),
    ['--seed', '341', '--budget', '950000', '--proof-json'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.signal, 'SIGSEGV', result.stderr);
  assert.ok([0, 3, 4].includes(result.status), `unexpected exit=${result.status} stderr=${result.stderr}`);
  const record = JSON.parse(result.stdout);
  assert.equal(record.seed, 341);
  assert.equal(record.status, 'SOLVED');
  assert.ok(record.nodes < 700_000, `pathological search used ${record.nodes} nodes`);
  assert.ok(record.proof.length <= 2_000, `pathological proof has ${record.proof.length} decisions`);
});
