import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../src/persistence/ActiveGameRepository.ts';
import type { TrifoldActiveGameSave } from '../src/persistence/ActiveGameSave.ts';

class MemoryStorage implements ActiveGameStorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function standardSave(seed = 21): TrifoldActiveGameSave {
  return {
    version: 1,
    mode: 'standard',
    seed,
    game: new TrifoldGame(createDeal(seed)).exportSave(),
    moves: 3,
    activeMs: 500,
    assisted: false,
    updatedAtMs: 123,
    standard: { partition: 'medium', difficulty: 'medium' },
  };
}

test('repository round-trips active game under trifoldActiveGame', () => {
  const storage = new MemoryStorage();
  const repo = new ActiveGameRepository(storage);
  const save = standardSave();
  repo.save(save);
  assert.ok(storage.values.has('trifoldActiveGame'));
  assert.deepEqual(repo.load(), save);
  repo.clear();
  assert.equal(repo.load(), null);
});

test('repository removes corrupt JSON and invalid active saves', () => {
  const storage = new MemoryStorage();
  const repo = new ActiveGameRepository(storage);
  storage.values.set('trifoldActiveGame', '{bad json');
  assert.equal(repo.load(), null);
  assert.equal(storage.values.has('trifoldActiveGame'), false);

  storage.values.set('trifoldActiveGame', JSON.stringify({ ...standardSave(), seed: 999 }));
  assert.equal(repo.load(), null);
  assert.equal(storage.values.has('trifoldActiveGame'), false);
});

test('repository remains usable when browser storage is unavailable or throws', () => {
  const throwing: ActiveGameStorageLike = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const blocked = new ActiveGameRepository(throwing);
  assert.doesNotThrow(() => blocked.save(standardSave()));
  assert.equal(blocked.load(), null);
  assert.doesNotThrow(() => blocked.clear());

  const unavailable = new ActiveGameRepository(null);
  assert.doesNotThrow(() => unavailable.save(standardSave()));
  assert.equal(unavailable.load(), null);
});
