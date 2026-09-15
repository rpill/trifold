import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';
import { settleDailyWin } from '../src/meta/daily/DailyWinSettlement.ts';
import { deriveCurrentStreak } from '../src/meta/daily/DailyHistory.ts';
import { createRewardDoubleOffer, claimRewardDouble } from '../src/meta/economy/RewardDouble.ts';
import { purchaseTheme, applyTheme } from '../src/meta/economy/ShopService.ts';
import { mergeProfiles } from '../src/meta/profile/ProfileMerge.ts';
import type { PlayerProfileV1, StandardDifficulty, StandardPartition } from '../src/meta/profile/ProfileTypes.ts';

function reload(profile: PlayerProfileV1): PlayerProfileV1 {
  return parsePlayerProfile(JSON.parse(JSON.stringify(profile)));
}

function standardWin(
  profile: PlayerProfileV1,
  seed: number,
  partition: StandardPartition,
  difficulty: StandardDifficulty,
): PlayerProfileV1 {
  const result = settleStandardWin(profile, {
    seed,
    partition,
    difficulty,
    moves: 40 + (seed % 7),
    activeMs: 120_000 + seed,
    assisted: false,
  });
  const offer = createRewardDoubleOffer({
    seed,
    difficulty,
    baseCoinsGranted: result.baseCoinsGranted,
    firstCompletion: result.firstCompletion,
  });
  return offer ? claimRewardDouble(result.profile, offer) : result.profile;
}

test('fresh guest profile survives the complete v1 meta loop without duplicate rewards', () => {
  let profile = createDefaultProfile();

  profile = standardWin(profile, 39_650, 'onboarding', 'easy');
  profile = { ...profile, tutorialCompleted: true };
  assert.equal(profile.tutorialCompleted, true);
  assert.equal(profile.mastery.stage.anyWins, 1);
  assert.deepEqual(profile.completedStandard.onboarding, [39_650]);

  for (let index = 0; index < 9; index += 1) {
    profile = standardWin(profile, 70_001 + index, 'hard', 'hard');
    if ((index + 2) % 3 === 0) profile = reload(profile);
  }

  assert.equal(profile.mastery.rank, 'player');
  assert.equal(profile.mastery.stage.anyWins, 0);
  assert.equal(profile.claimedRewardKeys.filter((key) => key === 'mastery-rank:player').length, 1);
  assert.equal(profile.coins, 290, 'base + doubled Standard rewards + one Player rank reward');

  const dailyFirst = settleDailyWin(profile, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 42,
    activeMs: 378_400,
  });
  profile = dailyFirst.profile;
  const dailyReplay = settleDailyWin(profile, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 39,
    activeMs: 300_000,
  });
  profile = dailyReplay.profile;
  assert.deepEqual(profile.daily.history['2026-09-14']?.officialResult, { moves: 42, activeMs: 378_400 });
  assert.deepEqual(profile.daily.history['2026-09-14']?.personalBest, { moves: 39, activeMs: 300_000 });

  const archive = settleDailyWin(profile, {
    dailyDateKey: '2026-09-13',
    completionDateKey: '2026-09-14',
    moves: 55,
    activeMs: 480_000,
  });
  profile = archive.profile;
  assert.equal(archive.coinsGranted, 5);
  assert.equal(profile.daily.history['2026-09-13']?.completedOnTime, false);
  assert.equal(deriveCurrentStreak(profile.daily.history, '2026-09-14'), 1, 'late archive completion must not repair streak');
  assert.equal(profile.coins, 310);

  const bought = purchaseTheme(profile, 'launch_01');
  assert.equal(bought.status, 'purchased');
  profile = bought.profile;
  const applied = applyTheme(profile, 'launch_01');
  assert.equal(applied.status, 'applied');
  profile = applied.profile;
  assert.equal(profile.coins, 10);
  assert.equal(profile.activeThemeId, 'launch_01');

  const cloud: PlayerProfileV1 = {
    ...createDefaultProfile(),
    completedStandard: { onboarding: [], easy: [88_888], medium: [], hard: [] },
    coins: 999,
    ownedThemeIds: ['base', 'launch_02'],
    activeThemeId: 'launch_02',
  };
  profile = mergeProfiles(profile, cloud);
  assert.equal(profile.coins, 999, 'merge must use max coin balance, never sum');
  assert.equal(profile.completedStandard.easy.includes(88_888), true);
  assert.equal(profile.completedStandard.hard.includes(70_001), true);
  assert.equal(profile.ownedThemeIds.includes('launch_01'), true);
  assert.equal(profile.ownedThemeIds.includes('launch_02'), true);

  const beforeRetryCoins = profile.coins;
  profile = settleStandardWin(profile, {
    seed: 70_001,
    partition: 'hard',
    difficulty: 'hard',
    moves: 30,
    activeMs: 100_000,
    assisted: false,
  }).profile;
  profile = settleDailyWin(profile, {
    dailyDateKey: '2026-09-14',
    completionDateKey: '2026-09-14',
    moves: 38,
    activeMs: 290_000,
  }).profile;
  assert.equal(profile.coins, beforeRetryCoins, 'replaying already-settled events must not grant coins again');
});
