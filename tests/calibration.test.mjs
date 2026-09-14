import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBudgets } from '../tools/deals/calibration.mjs';

test('calibration recommends rounded P90 and doubled P99 budgets', () => {
  const records = Array.from({ length: 1000 }, (_, index) => ({ status: 'SOLVED', nodes: (index + 1) * 1000 }));
  const result = recommendBudgets(records);
  assert.equal(result.solvedCount, 1000);
  assert.equal(result.p90Nodes, 900000);
  assert.equal(result.p99Nodes, 990000);
  assert.equal(result.recommendedFastBudget, 900000);
  assert.equal(result.recommendedSlowBudget, 2000000);
  assert.equal(result.sufficient, true);
  assert.ok(result.recommendedSlowBudget > result.recommendedFastBudget);
});

test('calibration marks fewer than 1000 solved deals insufficient', () => {
  const result = recommendBudgets([
    { status: 'SOLVED', nodes: 12345 },
    { status: 'UNDETERMINED', nodes: 5000000 },
  ]);
  assert.equal(result.solvedCount, 1);
  assert.equal(result.sufficient, false);
  assert.ok(result.recommendedSlowBudget > result.recommendedFastBudget);
});

test('calibration rejects invalid solved node counts', () => {
  assert.throws(() => recommendBudgets([{ status: 'SOLVED', nodes: -1 }]), /nodes/i);
});
