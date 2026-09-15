import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';

class MemoryProfileStore implements ProfileStore {
  profile: PlayerProfileV1;
  saves = 0;
  constructor(profile = createDefaultProfile()) { this.profile = structuredClone(profile); }
  async load(): Promise<PlayerProfileV1> { return structuredClone(this.profile); }
  async save(profile: PlayerProfileV1): Promise<void> {
    await Promise.resolve();
    this.profile = structuredClone(profile);
    this.saves += 1;
  }
}

test('mutate serializes profile writes and returns the committed profile', async () => {
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  await Promise.all([
    repo.mutate((p) => ({ ...p, coins: p.coins + 1 })),
    repo.mutate((p) => ({ ...p, coins: p.coins + 1 })),
  ]);
  assert.equal(repo.current.coins, 2);
  assert.equal(store.profile.coins, 2);
});

test('repository current is a clone and invalid mutations never commit', async () => {
  const store = new MemoryProfileStore();
  const repo = await ProfileRepository.open(store);
  const current = repo.current;
  (current.completedStandard.easy as number[]).push(99);
  assert.deepEqual(repo.current.completedStandard.easy, []);
  await assert.rejects(() => repo.mutate((p) => ({ ...p, coins: -1 })), /coins/i);
  assert.equal(repo.current.coins, 0);
});
