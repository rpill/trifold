import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import { LocalProfileStore } from '../src/meta/profile/LocalProfileStore.ts';

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

test('local store round-trips a valid profile', async () => {
  const storage = new MemoryStorage();
  const store = new LocalProfileStore(storage);
  const profile = createDefaultProfile();
  await store.save({ ...profile, coins: 123 });
  assert.equal((await store.load()).coins, 123);
});

test('corrupt browser payload falls back to a fresh profile without throwing', async () => {
  const storage = new MemoryStorage();
  storage.setItem('trifoldPlayerProfile', '{bad json');
  const store = new LocalProfileStore(storage);
  assert.deepEqual(await store.load(), createDefaultProfile());
});

test('returned profiles are clones and cannot mutate store memory', async () => {
  const store = new LocalProfileStore(null);
  const first = await store.load();
  (first.completedStandard.easy as number[]).push(123);
  const second = await store.load();
  assert.deepEqual(second.completedStandard.easy, []);
});
