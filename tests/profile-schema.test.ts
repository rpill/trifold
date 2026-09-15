import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';

test('default profile is guest-ready and owns only the base theme', () => {
  const profile = createDefaultProfile();
  assert.equal(profile.version, 1);
  assert.equal(profile.selectedStandardDifficulty, 'easy');
  assert.deepEqual(profile.completedStandard, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.equal(profile.mastery.rank, 'novice');
  assert.equal(profile.coins, 0);
  assert.deepEqual(profile.ownedThemeIds, ['base']);
  assert.equal(profile.activeThemeId, 'base');
  assert.equal(profile.activeStandard, null);
  assert.deepEqual(profile.daily, { history: {}, active: null, bestStreak: 0 });
});

test('parser rejects unknown profile versions instead of silently guessing', () => {
  assert.throws(() => parsePlayerProfile({ version: 99 }), /profile version/i);
});

test('parser deduplicates persistent seed and reward arrays', () => {
  const profile = createDefaultProfile();
  const parsed = parsePlayerProfile({
    ...profile,
    completedStandard: { ...profile.completedStandard, easy: [7, 7, 8] },
    masteryCreditedStandardSeeds: [7, 7, 9],
    claimedRewardKeys: ['standard:easy:7', 'standard:easy:7'],
    ownedThemeIds: ['base', 'base'],
  });
  assert.deepEqual(parsed.completedStandard.easy, [7, 8]);
  assert.deepEqual(parsed.masteryCreditedStandardSeeds, [7, 9]);
  assert.deepEqual(parsed.claimedRewardKeys, ['standard:easy:7']);
  assert.deepEqual(parsed.ownedThemeIds, ['base']);
});

test('parser rejects negative balances and counters', () => {
  const profile = createDefaultProfile();
  assert.throws(() => parsePlayerProfile({ ...profile, coins: -1 }), /coins/i);
  assert.throws(() => parsePlayerProfile({ ...profile, onboardingWins: -1 }), /onboardingWins/i);
});


test('profile language override defaults to automatic and old saves without it migrate safely', () => {
  const profile = createDefaultProfile();
  assert.equal(profile.settings.language, null);
  const { language: _language, ...legacySettings } = profile.settings;
  const parsed = parsePlayerProfile({ ...profile, settings: legacySettings });
  assert.equal(parsed.settings.language, null);
});

test('profile parser accepts only supported explicit language overrides', () => {
  const profile = createDefaultProfile();
  assert.equal(parsePlayerProfile({ ...profile, settings: { ...profile.settings, language: 'en' } }).settings.language, 'en');
  assert.equal(parsePlayerProfile({ ...profile, settings: { ...profile.settings, language: 'ru' } }).settings.language, 'ru');
  assert.throws(() => parsePlayerProfile({ ...profile, settings: { ...profile.settings, language: 'de' } }), /language/i);
});
