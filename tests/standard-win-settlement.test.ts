import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';

const baseResult = {
  seed: 21,
  partition: 'easy' as const,
  difficulty: 'easy' as const,
  moves: 50,
  activeMs: 60_000,
  assisted: false,
};

test('first Easy Medium Hard completion grants 5 7 10 base coins and repeats grant zero', () => {
  for (const [difficulty, seed, expected] of [
    ['easy', 21, 5],
    ['medium', 31, 7],
    ['hard', 41, 10],
  ] as const) {
    const first = settleStandardWin(createDefaultProfile(), {
      ...baseResult,
      seed,
      partition: difficulty,
      difficulty,
    });
    assert.equal(first.baseCoinsGranted, expected);
    assert.equal(first.firstCompletion, true);
    const replay = settleStandardWin(first.profile, {
      ...baseResult,
      seed,
      partition: difficulty,
      difficulty,
    });
    assert.equal(replay.baseCoinsGranted, 0);
    assert.equal(replay.firstCompletion, false);
  }
});

test('assisted first completion gets coins but no record or Mastery, later clean win can earn both', () => {
  const assisted = settleStandardWin(createDefaultProfile(), { ...baseResult, assisted: true });
  assert.equal(assisted.baseCoinsGranted, 5);
  assert.equal(assisted.masteryAdvanced, false);
  assert.equal(assisted.recordAccepted, false);
  assert.equal(assisted.profile.mastery.stage.anyWins, 0);
  assert.deepEqual(assisted.profile.masteryCreditedStandardSeeds, []);

  const clean = settleStandardWin(assisted.profile, { ...baseResult, moves: 48, activeMs: 55_000, assisted: false });
  assert.equal(clean.baseCoinsGranted, 0);
  assert.equal(clean.masteryAdvanced, true);
  assert.equal(clean.recordAccepted, true);
  assert.equal(clean.profile.mastery.stage.anyWins, 1);
  assert.deepEqual(clean.profile.masteryCreditedStandardSeeds, [21]);
});

test('personal best uses fewer moves then active time and assisted never replaces it', () => {
  const first = settleStandardWin(createDefaultProfile(), { ...baseResult, moves: 40, activeMs: 70_000 });
  const slower = settleStandardWin(first.profile, { ...baseResult, moves: 40, activeMs: 80_000 });
  assert.equal(slower.recordAccepted, false);
  const faster = settleStandardWin(slower.profile, { ...baseResult, moves: 40, activeMs: 60_000 });
  assert.equal(faster.recordAccepted, true);
  const assisted = settleStandardWin(faster.profile, { ...baseResult, moves: 20, activeMs: 10_000, assisted: true });
  assert.equal(assisted.recordAccepted, false);
  assert.deepEqual(assisted.profile.standardPersonalBests['easy:21'], { moves: 40, activeMs: 60_000 });
});

test('Mastery credits a Standard seed once across stage transitions and records future Prestige history', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: {
      rank: 'player' as const,
      stage: { anyWins: 0, mediumWins: 14, hardWins: 2, onTimeDailyWins: 0 },
    },
  };
  const promoted = settleStandardWin(profile, {
    ...baseResult,
    seed: 99,
    partition: 'medium',
    difficulty: 'medium',
  });
  assert.equal(promoted.profile.mastery.stage.mediumWins, 15);
  assert.equal(promoted.rankAdvancedTo, null, 'still needs one more Hard');
  assert.deepEqual(promoted.profile.futurePrestige.mediumSeeds, [99]);

  const hard = settleStandardWin(promoted.profile, {
    ...baseResult,
    seed: 100,
    partition: 'hard',
    difficulty: 'hard',
  });
  assert.equal(hard.rankAdvancedTo, 'tactician');
  assert.equal(hard.profile.coins, 10 + 7 + 150);
  assert.deepEqual(hard.profile.mastery.stage, { anyWins: 0, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 });
  assert.deepEqual(hard.profile.futurePrestige.hardSeeds, [100]);

  const replay = settleStandardWin(hard.profile, {
    ...baseResult,
    seed: 100,
    partition: 'hard',
    difficulty: 'hard',
  });
  assert.equal(replay.profile.mastery.stage.hardWins, 0);
});

test('onboardingWins counts each first Standard completion and caps at five', () => {
  let profile = createDefaultProfile();
  for (let index = 0; index < 7; index += 1) {
    const difficulty = index % 2 === 0 ? 'easy' as const : 'hard' as const;
    profile = settleStandardWin(profile, {
      ...baseResult,
      seed: 500 + index,
      partition: difficulty,
      difficulty,
    }).profile;
  }
  assert.equal(profile.onboardingWins, 5);
});


test('settlement carries literal Mastery before and after snapshots for the win UI', () => {
  const profile = {
    ...createDefaultProfile(),
    mastery: {
      rank: 'novice' as const,
      stage: { anyWins: 3, mediumWins: 0, hardWins: 0, onTimeDailyWins: 0 },
    },
  };
  const result = settleStandardWin(profile, { ...baseResult, seed: 77 });
  assert.deepEqual(result.masteryBefore, profile.mastery);
  assert.equal(result.masteryAfter.rank, 'novice');
  assert.equal(result.masteryAfter.stage.anyWins, 4);
  assert.equal(result.masteryWasAlreadyCredited, false);
});
