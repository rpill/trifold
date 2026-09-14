import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSolverOutput } from '../tools/deals/solver-client.mjs';

test('solver client parses undetermined protocol records', () => {
  assert.deepEqual(parseSolverOutput('{"status":"UNDETERMINED","seed":7,"nodes":100}', 7), {
    status: 'UNDETERMINED', seed: 7, nodes: 100, proof: undefined,
  });
});

test('solver client requires non-empty proof for solved result', () => {
  assert.throws(
    () => parseSolverOutput('{"status":"SOLVED","seed":7,"nodes":1,"proof":[]}', 7),
    /non-empty proof/i,
  );
});

test('solver client rejects seed mismatch and invalid node counts', () => {
  assert.throws(
    () => parseSolverOutput('{"status":"SOLVED","seed":8,"nodes":1,"proof":[{}]}', 7),
    /seed mismatch/i,
  );
  assert.throws(
    () => parseSolverOutput('{"status":"UNSOLVABLE","seed":7,"nodes":-1}', 7),
    /nodes/i,
  );
});
