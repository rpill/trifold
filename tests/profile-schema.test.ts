import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';

test('default profile is guest-ready and contains no economy or theme ownership fields', () => {
  const profile = createDefaultProfile();
  assert.equal(profile.version, 1);
  assert.equal(profile.selectedStandardDifficulty, 'easy');
  assert.deepEqual(profile.completedStandard, { onboarding: [], easy: [], medium: [], hard: [] });
  assert.equal(profile.mastery.rank, 'novice');
  assert.equal(profile.activeStandard, null);
  assert.deepEqual(profile.daily, { history: {}, active: null, bestStreak: 0 });
  for (const key of ['coins', 'claimedRewardKeys', 'ownedThemeIds', 'activeThemeId']) {
    assert.equal(key in profile, false, `${key} must not remain in the shipping profile`);
  }
});

test('parser rejects unknown profile versions instead of silently guessing', () => {
  assert.throws(() => parsePlayerProfile({ version: 99 }), /profile version/i);
});

test('parser deduplicates persistent progress arrays', () => {
  const profile = createDefaultProfile();
  const parsed = parsePlayerProfile({
    ...profile,
    completedStandard: { ...profile.completedStandard, easy: [7, 7, 8] },
    masteryCreditedStandardSeeds: [7, 7, 9],
  });
  assert.deepEqual(parsed.completedStandard.easy, [7, 8]);
  assert.deepEqual(parsed.masteryCreditedStandardSeeds, [7, 9]);
});

test('legacy economy and theme fields are ignored rather than persisted or rejected', () => {
  const legacy = {
    ...createDefaultProfile(),
    coins: 999,
    claimedRewardKeys: ['standard:easy:7'],
    ownedThemeIds: ['base', 'launch_03'],
    activeThemeId: 'launch_03',
  };
  const parsed = parsePlayerProfile(legacy);
  for (const key of ['coins', 'claimedRewardKeys', 'ownedThemeIds', 'activeThemeId']) {
    assert.equal(key in parsed, false, `${key} must be dropped from legacy saves`);
  }
});


test('legacy Daily reward-claim marker is accepted and dropped from normalized history', () => {
  const profile = createDefaultProfile();
  const parsed = parsePlayerProfile({
    ...profile,
    daily: {
      ...profile.daily,
      history: {
        '2026-09-14': {
          dateKey: '2026-09-14',
          completed: true,
          completedOnTime: true,
          officialResult: { moves: 42, activeMs: 300_000 },
          personalBest: { moves: 42, activeMs: 300_000 },
          firstCompletionRewardClaimed: true,
        },
      },
    },
  });
  const entry = parsed.daily.history['2026-09-14'];
  assert.ok(entry);
  assert.equal('firstCompletionRewardClaimed' in entry, false);
});

test('parser rejects negative gameplay counters', () => {
  const profile = createDefaultProfile();
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
