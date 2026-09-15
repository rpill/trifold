import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailySelection } from '../src/meta/daily/DailySchedule.ts';

function fixtureCatalog() {
  return {
    metadata: {
      dailyScheduleStart: '2026-01-01',
      dailyScheduleLength: 3,
    },
    getDailySeedByOffset(offset: number) {
      return [51, 52, 53][offset] ?? 0;
    },
  };
}

test('2026-01-01 maps to Daily offset 0', () => {
  assert.deepEqual(getDailySelection(fixtureCatalog(), '2026-01-01'), {
    dateKey: '2026-01-01', offset: 0, seed: 51,
  });
});

test('later date maps through manifest offset', () => {
  assert.deepEqual(getDailySelection(fixtureCatalog(), '2026-01-03'), {
    dateKey: '2026-01-03', offset: 2, seed: 53,
  });
});

test('date outside manifest schedule is rejected', () => {
  assert.throws(() => getDailySelection(fixtureCatalog(), '2046-01-01'), /schedule/i);
  assert.throws(() => getDailySelection(fixtureCatalog(), '2025-12-31'), /schedule/i);
});
