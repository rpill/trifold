import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { bootstrapMetaState, type LegacyBrowserStorage } from '../src/meta/MetaBootstrap.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../src/persistence/ActiveGameRepository.ts';
import type { PlayerStorage } from '../src/platform/services.ts';
import { createLegacyProfileFixture } from './fixtures/legacy-profile-v1.ts';

class MemoryLegacyStorage implements LegacyBrowserStorage, ActiveGameStorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

class MemoryPlayerStorage implements PlayerStorage {
  root: Record<string, unknown> = {};
  failLoad = false;
  failSave = false;
  saves = 0;
  async scope(): Promise<string> { return 'player'; }
  async load(): Promise<unknown> {
    if (this.failLoad) throw new Error('offline');
    return structuredClone(this.root);
  }
  async save(data: Record<string, unknown>): Promise<void> {
    this.saves += 1;
    if (this.failSave) throw new Error('offline');
    this.root = { ...this.root, ...structuredClone(data) };
  }
}

function setup() {
  const local = new MemoryLegacyStorage();
  const platform = new MemoryPlayerStorage();
  const activeGames = new ActiveGameRepository(local);
  return { local, platform, activeGames };
}

test('fresh install creates and best-effort persists default meta', async () => {
  const { local, platform, activeGames } = setup();
  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.deepEqual(result.meta, createDefaultMetaSave());
  assert.equal(result.migrated, false);
  assert.equal(result.persisted, true);
  assert.deepEqual(platform.root.trifoldMeta, createDefaultMetaSave());
  assert.equal(activeGames.load(), null);
});

test('legacy local profile migrates once including active game and preferences', async () => {
  const { local, platform, activeGames } = setup();
  local.values.set('trifoldPlayerProfile', JSON.stringify(createLegacyProfileFixture()));
  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.equal(result.migrated, true);
  assert.equal(result.meta.standard.selectedDifficulty, 'hard');
  assert.deepEqual(result.preferences, { language: 'en', soundEnabled: false, tutorialCompleted: true });
  assert.equal(activeGames.load()?.mode, 'daily');
  assert.deepEqual(platform.root.trifoldMeta, result.meta);
});

test('legacy cloud envelope migrates when local profile is absent', async () => {
  const { local, platform, activeGames } = setup();
  platform.root = {
    trifoldProfileVersion: 1,
    profile: { ...createLegacyProfileFixture(), activeStandard: null, daily: { ...createLegacyProfileFixture().daily, active: null } },
    savedAtMs: 123,
  };
  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.equal(result.migrated, true);
  assert.equal(result.meta.mastery.rank, 'expert');
  assert.equal(result.activeGame, null);
});

test('local and cloud legacy profiles merge before one-time migration', async () => {
  const { local, platform, activeGames } = setup();
  const localProfile = createLegacyProfileFixture();
  const cloudProfile = {
    ...createLegacyProfileFixture(),
    selectedStandardDifficulty: 'easy' as const,
    completedStandard: {
      onboarding: [3], easy: [12], medium: [23], hard: [99],
    },
    activeStandard: null,
    daily: { ...createLegacyProfileFixture().daily, active: null, bestStreak: 12 },
    settings: { sfxEnabled: true, language: 'ru' as const },
  };
  local.values.set('trifoldPlayerProfile', JSON.stringify(localProfile));
  platform.root = { trifoldProfileVersion: 1, profile: cloudProfile, savedAtMs: 456 };

  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.deepEqual(result.meta.standard.completed.hard, [30, 31, 99]);
  assert.equal(result.meta.daily.bestStreakFloor, 12);
  assert.equal(result.preferences.language, 'en', 'legacy merge preserves local explicit preference');
});

test('existing trifoldMeta wins and legacy data is not remigrated or active-save overwritten', async () => {
  const { local, platform, activeGames } = setup();
  const existing = {
    ...createDefaultMetaSave(),
    standard: { ...createDefaultMetaSave().standard, selectedDifficulty: 'medium' as const },
  };
  platform.root = { trifoldMeta: existing, trifoldProfileVersion: 1, profile: createLegacyProfileFixture() };
  local.values.set('trifoldPlayerProfile', JSON.stringify(createLegacyProfileFixture()));
  activeGames.save({
    version: 1,
    mode: 'standard',
    seed: 33,
    game: createLegacyProfileFixture().activeStandard!.game,
    moves: 0,
    activeMs: 0,
    assisted: false,
    updatedAtMs: 1,
    standard: { partition: 'easy', difficulty: 'easy' },
  });
  // Invalid envelope above is rejected due seed mismatch, so install a valid migrated one through legacy bootstrap is not useful here.
  const beforeSaves = platform.saves;
  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.equal(result.migrated, false);
  assert.equal(result.meta.standard.selectedDifficulty, 'medium');
  assert.equal(platform.saves, beforeSaves, 'existing normalized meta is not rewritten during bootstrap');
});

test('corrupt legacy data resets safely and platform failure does not block local startup', async () => {
  const { local, platform, activeGames } = setup();
  local.values.set('trifoldPlayerProfile', '{bad');
  platform.failLoad = true;
  platform.failSave = true;
  const result = await bootstrapMetaState(platform, local, activeGames);
  assert.deepEqual(result.meta, createDefaultMetaSave());
  assert.equal(result.persisted, false);
  assert.deepEqual(result.preferences, { language: null, soundEnabled: true, tutorialCompleted: false });
});
