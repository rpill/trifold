import assert from 'node:assert/strict';
import test from 'node:test';

import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';

class MemoryStorage implements MetaJournalStorage {
  readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('blocked');
    this.values.set(key, value);
  }
}

test('journal persists pending operations per scope and restores them in sequence', () => {
  const storage = new MemoryStorage();
  const journal = new MetaJournal('player-a', storage);
  const one = journal.append({ kind: 'set-standard-difficulty', difficulty: 'medium' });
  const two = journal.append({ kind: 'standard-served', seed: 42, partition: 'medium', difficulty: 'medium' });
  assert.ok(one && two);
  assert.equal(two.sequence, one.sequence + 1);
  assert.ok([...storage.values.keys()].some((key) => key.startsWith('trifoldMetaJournal:')));

  const restored = new MetaJournal('player-a', storage);
  assert.deepEqual(restored.pending, [one, two]);
  assert.equal(restored.acknowledge([one]), true);
  assert.deepEqual(restored.pending, [two]);
});

test('journal rejects persistence failure without mutating pending memory state', () => {
  const storage = new MemoryStorage();
  const journal = new MetaJournal('player-b', storage);
  storage.failWrites = true;
  assert.equal(journal.append({ kind: 'set-standard-difficulty', difficulty: 'hard' }), null);
  assert.deepEqual(journal.pending, []);
  assert.equal(journal.durable, false);
});

test('corrupt persisted journal starts a fresh valid stream', () => {
  const storage = new MemoryStorage();
  storage.values.set('trifoldMetaJournal:local', '{broken');
  const journal = new MetaJournal('local', storage);
  assert.deepEqual(journal.pending, []);
  assert.equal(journal.nextSequence, 1);
  assert.ok(journal.stream.length > 0);
});
