import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { createDeal } from '../src/game/model/deal.ts';

test('profile parser accepts Daily history and a matching Daily active save', () => {
  const profile = createDefaultProfile();
  const seed = 123;
  const game = new TrifoldGame(createDeal(seed));
  const parsed = parsePlayerProfile({
    ...profile,
    daily: {
      bestStreak: 4,
      history: {
        '2026-09-14': {
          dateKey: '2026-09-14',
          completed: true,
          completedOnTime: true,
          officialResult: { moves: 42, activeMs: 300_000 },
          personalBest: { moves: 40, activeMs: 290_000 },
        },
      },
      active: {
        version: 1,
        dailyDateKey: '2026-09-13',
        seed,
        game: game.exportSave(),
        moves: 8,
        activeMs: 50_000,
        updatedAtMs: 100,
      },
    },
  });
  assert.equal(parsed.daily.bestStreak, 4);
  assert.equal(parsed.daily.active?.dailyDateKey, '2026-09-13');
  assert.equal(parsed.daily.history['2026-09-14']?.completedOnTime, true);
});

test('profile parser rejects malformed Daily dates and seed/save mismatch', () => {
  const profile = createDefaultProfile();
  const game = new TrifoldGame(createDeal(123));
  assert.throws(() => parsePlayerProfile({
    ...profile,
    daily: { ...profile.daily, history: { nope: {
      dateKey: 'nope', completed: true, completedOnTime: false, officialResult: null,
      personalBest: { moves: 1, activeMs: 1 },
    } } },
  }), /date/i);
  assert.throws(() => parsePlayerProfile({
    ...profile,
    daily: { ...profile.daily, active: {
      version: 1, dailyDateKey: '2026-09-14', seed: 124, game: game.exportSave(),
      moves: 1, activeMs: 1, updatedAtMs: 1,
    } },
  }), /seed/i);
});
