import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_BANDS, generateDailySchedule } from '../tools/deals/daily-schedule.mjs';

test('daily weekday bands match the approved Trifold schedule', () => {
  assert.deepEqual(DAILY_BANDS, {
    1: [0, 15], 2: [10, 30], 3: [25, 45], 4: [40, 60],
    5: [55, 75], 6: [70, 90], 0: [80, 95],
  });
});

test('daily schedule advances UTC dates deterministically across year boundary', () => {
  const records = [];
  let seed = 1;
  for (const score of [5, 20, 35, 50, 65, 80, 90]) {
    for (let i = 0; i < 20; i += 1) records.push({ seed: seed++, difficultyScore: score });
  }
  const a = generateDailySchedule(records, { startDailyId: '2026-12-29', length: 7, shuffleSeed: 123 });
  const b = generateDailySchedule(records, { startDailyId: '2026-12-29', length: 7, shuffleSeed: 123 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((row) => row.dailyId), [
    '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04',
  ]);
  assert.equal(new Set(a.map((row) => row.seed)).size, a.length);
  assert.ok(a.every((row) => row.difficultyScore <= 95));
});

test('daily schedule hard-fails instead of widening a starved weekday band', () => {
  const records = [{ seed: 1, difficultyScore: 5 }];
  assert.throws(
    () => generateDailySchedule(records, { startDailyId: '2026-01-05', length: 8 }),
    /insufficient daily candidates/i,
  );
});

test('daily schedule rejects duplicate seeds', () => {
  assert.throws(
    () => generateDailySchedule([{ seed: 1, difficultyScore: 5 }, { seed: 1, difficultyScore: 10 }], { length: 1 }),
    /duplicate seed/i,
  );
});
