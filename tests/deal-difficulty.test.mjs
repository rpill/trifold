import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTY_WEIGHTS,
  scorePopulation,
  standardQuotasForTotal,
  partitionStandard,
  isOnboardingCandidate,
} from '../tools/deals/difficulty.mjs';

function record(seed, nodes, metrics) {
  return { seed, nodes, verification: { metrics } };
}

const metric = (decisionActions, rearrangementMoves, freeCellTouches, earlyProgressActions, blockedDragonPressure) => ({
  decisionActions, rearrangementMoves, freeCellTouches, earlyProgressActions, blockedDragonPressure,
});

test('difficulty model uses the approved Trifold weights and log1p solver nodes', () => {
  assert.deepEqual(DIFFICULTY_WEIGHTS, {
    solverNodes: 0.30,
    decisionActions: 0.20,
    rearrangementMoves: 0.20,
    freeCellTouches: 0.15,
    earlyProgressActions: 0.10,
    blockedDragonPressure: 0.05,
  });
  const scored = scorePopulation([
    record(1, 0, metric(1, 1, 0, 1, 0)),
    record(2, Math.E - 1, metric(2, 2, 1, 2, 0.2)),
  ]);
  assert.equal(scored[0].difficultyInputs.solverNodes, 0);
  assert.ok(Math.abs(scored[1].difficultyInputs.solverNodes - 1) < 1e-12);
});

test('tied metric values receive average-rank percentiles and deterministic final scores', () => {
  const scored = scorePopulation([
    record(3, 10, metric(5, 2, 1, 3, 0)),
    record(1, 10, metric(5, 2, 1, 3, 0)),
    record(2, 100, metric(10, 5, 3, 8, 0.8)),
  ]);
  assert.equal(scored[0].difficultyPercentiles.solverNodes, 25);
  assert.equal(scored[1].difficultyPercentiles.solverNodes, 25);
  assert.equal(scored[2].difficultyPercentiles.solverNodes, 100);
  assert.equal(scored[0].difficultyScore, scored[1].difficultyScore);
});

test('40k Standard quotas are exact and development totals scale deterministically', () => {
  assert.deepEqual(standardQuotasForTotal(40000), {
    onboarding: 500,
    easy: 13167,
    medium: 15361,
    hard: 10972,
  });
  assert.deepEqual(standardQuotasForTotal(400), {
    onboarding: 5,
    easy: 132,
    medium: 153,
    hard: 110,
  });
  assert.throws(() => standardQuotasForTotal(3), />= 4/i);
});

test('onboarding filter and partition exclude pathological score >95 with seed tie-breaks', () => {
  const records = [
    { seed: 5, difficultyScore: 10, difficultyPercentiles: { freeCellTouches: 10, rearrangementMoves: 10, earlyProgressActions: 10 } },
    { seed: 2, difficultyScore: 10, difficultyPercentiles: { freeCellTouches: 10, rearrangementMoves: 10, earlyProgressActions: 10 } },
    { seed: 7, difficultyScore: 30, difficultyPercentiles: { freeCellTouches: 30, rearrangementMoves: 30, earlyProgressActions: 30 } },
    { seed: 8, difficultyScore: 60, difficultyPercentiles: { freeCellTouches: 60, rearrangementMoves: 60, earlyProgressActions: 60 } },
    { seed: 9, difficultyScore: 90, difficultyPercentiles: { freeCellTouches: 90, rearrangementMoves: 90, earlyProgressActions: 90 } },
    { seed: 10, difficultyScore: 96, difficultyPercentiles: { freeCellTouches: 1, rearrangementMoves: 1, earlyProgressActions: 1 } },
  ];
  assert.equal(isOnboardingCandidate(records[0]), true);
  assert.equal(isOnboardingCandidate(records[2]), false);
  const partitions = partitionStandard(records, { onboarding: 1, easy: 1, medium: 1, hard: 1 });
  assert.deepEqual(partitions.onboarding.map((r) => r.seed), [2]);
  assert.deepEqual([...partitions.easy, ...partitions.medium, ...partitions.hard].map((r) => r.seed), [5, 7, 8]);
  assert.equal(Object.values(partitions).flat().some((r) => r.seed === 10), false);
});
