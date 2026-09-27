import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { migrateLegacyProfile } from '../src/meta/LegacyProfileMigration.ts';
import { createLegacyProfileFixture } from './fixtures/legacy-profile-v1.ts';

test('migrates legacy Standard, Mastery, Daily and preferences while dropping removed economy/theme fields', () => {
  const legacy = createLegacyProfileFixture();
  const snapshot = structuredClone(legacy);
  const result = migrateLegacyProfile(legacy);

  assert.deepEqual(legacy, snapshot, 'migration must not mutate legacy input');
  assert.equal(result.meta.standard.selectedDifficulty, 'hard');
  assert.deepEqual(result.meta.standard.completed, {
    onboarding: [1, 2], easy: [10], medium: [20], hard: [30, 31],
  });
  assert.deepEqual(result.meta.standard.masteryCreditedSeeds, [10, 20, 30]);
  assert.deepEqual(result.meta.standard.personalBests, legacy.standardPersonalBests);
  assert.equal(result.meta.standard.onboardingWins, 3);
  assert.deepEqual(result.meta.mastery, legacy.mastery);
  assert.deepEqual(result.meta.futurePrestige, {
    mediumSeeds: [20, 22], hardSeeds: [30, 31], onTimeDailyDates: ['2026-09-20', '2026-09-21'],
  });
  assert.equal(result.meta.daily.bestStreakFloor, 9);
  assert.deepEqual(result.meta.daily.records['2026-09-20'], {
    completed: true,
    completedOnTime: true,
    attempts: 1,
    officialResult: { moves: 88, activeMs: 54_000 },
    personalBest: { moves: 80, activeMs: 50_000 },
  });
  assert.deepEqual(result.meta.daily.records['2026-09-19'], {
    completed: true,
    completedOnTime: false,
    attempts: 1,
    personalBest: { moves: 91, activeMs: 60_000 },
  });
  assert.deepEqual(result.preferences, { language: 'en', soundEnabled: false, tutorialCompleted: true });

  assert.ok(result.activeGame);
  assert.equal(result.activeGame.mode, 'daily', 'newest legacy active game wins deterministically');
  assert.equal(result.activeGame.seed, 118);
  assert.deepEqual(result.activeGame.daily, { dateKey: '2026-09-18', kind: 'archive' });
  assert.equal(result.activeGame.assisted, false);

  const serialized = JSON.stringify(result.meta);
  assert.doesNotMatch(serialized, /ownedThemeIds|activeThemeId|claimedRewardKeys|"coins"\s*:/u);
});

test('maps active Standard when it is the only or newest valid legacy active game', () => {
  const legacy = createLegacyProfileFixture();
  const result = migrateLegacyProfile({
    ...legacy,
    daily: { ...legacy.daily, active: { ...legacy.daily.active!, updatedAtMs: 100 } },
  });
  assert.ok(result.activeGame);
  assert.equal(result.activeGame.mode, 'standard');
  assert.equal(result.activeGame.seed, 44);
  assert.deepEqual(result.activeGame.standard, { partition: 'medium', difficulty: 'medium' });
  assert.equal(result.activeGame.assisted, true);
});

test('corrupt or unsupported legacy input falls back safely without inventing progress', () => {
  const result = migrateLegacyProfile({ version: 999, coins: 1234, activeThemeId: 'royal' });
  assert.deepEqual(result.meta, createDefaultMetaSave());
  assert.equal(result.activeGame, null);
  assert.deepEqual(result.preferences, { language: null, soundEnabled: true, tutorialCompleted: false });
});
