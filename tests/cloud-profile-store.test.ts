import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudProfileStore } from '../src/meta/profile/CloudProfileStore.ts';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import type { PlayerStorage, TrustedClock } from '../src/platform/services.ts';

class MemoryProfileStore implements ProfileStore {
  profile = createDefaultProfile();
  async load() { return structuredClone(this.profile); }
  async save(profile: typeof this.profile) { this.profile = structuredClone(profile); }
}

class MemoryCloudStorage implements PlayerStorage {
  payload: unknown = {};
  saves = 0;
  failSave = false;
  async scope() { return 'yandex:u1'; }
  async load() { return structuredClone(this.payload); }
  async save(data: Record<string, unknown>) {
    this.saves += 1;
    if (this.failSave) throw new Error('offline');
    this.payload = structuredClone(data);
  }
}

const clock: TrustedClock = { nowMs: () => 123456 };

test('cloud profile store wraps profile in versioned envelope', async () => {
  const storage = new MemoryCloudStorage();
  const cloud = new CloudProfileStore(storage, clock);
  assert.equal(await cloud.load(), null);
  const profile = { ...createDefaultProfile(), coins: 55 };
  await cloud.save(profile, true);
  assert.deepEqual(storage.payload, { trifoldProfileVersion: 1, profile, savedAtMs: 123456 });
  assert.equal((await cloud.load())?.coins, 55);
});

test('invalid cloud payload behaves as missing cloud profile', async () => {
  const storage = new MemoryCloudStorage();
  storage.payload = { trifoldProfileVersion: 999, profile: { bad: true } };
  assert.equal(await new CloudProfileStore(storage, clock).load(), null);
});

test('repository connectCloud merges, saves both, then fans out future writes', async () => {
  const local = new MemoryProfileStore();
  local.profile = { ...local.profile, coins: 100 };
  const storage = new MemoryCloudStorage();
  storage.payload = { trifoldProfileVersion: 1, profile: { ...createDefaultProfile(), coins: 200 }, savedAtMs: 1 };
  const repo = await ProfileRepository.open(local);
  await repo.connectCloud({ storage, clock });
  assert.equal(repo.current.coins, 200);
  assert.equal(local.profile.coins, 200);
  assert.equal((storage.payload as any).profile.coins, 200);
  await repo.mutate((profile) => ({ ...profile, coins: 333 }));
  assert.equal(local.profile.coins, 333);
  assert.equal((storage.payload as any).profile.coins, 333);
});

test('cloud write failure does not roll back committed local profile', async () => {
  const local = new MemoryProfileStore();
  const storage = new MemoryCloudStorage();
  const repo = await ProfileRepository.open(local);
  await repo.connectCloud({ storage, clock });
  storage.failSave = true;
  const result = await repo.mutate((profile) => ({ ...profile, coins: 77 }));
  assert.equal(result.coins, 77);
  assert.equal(local.profile.coins, 77);
  assert.equal(repo.current.coins, 77);
});
