import assert from 'node:assert/strict';
import test from 'node:test';

import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

class JournalStorage implements MetaJournalStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class FakePlayerStorage implements PlayerStorage {
  root: Record<string, unknown> = {};
  failLoads = 0;
  failSaves = 0;
  loadCalls = 0;
  saveCalls = 0;
  async scope(): Promise<string> { return 'test'; }
  async load(): Promise<unknown> {
    this.loadCalls += 1;
    if (this.failLoads-- > 0) throw new Error('load failed');
    return structuredClone(this.root);
  }
  async save(data: Record<string, unknown>): Promise<void> {
    this.saveCalls += 1;
    if (this.failSaves-- > 0) throw new Error('save failed');
    this.root = { ...this.root, ...structuredClone(data) };
  }
}

test('session retries load once, replays pending journal and flushes it durably', async () => {
  const player = new FakePlayerStorage();
  player.failLoads = 1;
  player.root = { trifoldMeta: createDefaultMetaSave() };
  const journalStorage = new JournalStorage();
  const journal = new MetaJournal('test', journalStorage);
  const pending = journal.append({ kind: 'set-standard-difficulty', difficulty: 'hard' });
  assert.ok(pending);

  const session = new MetaSession(player, journal);
  assert.equal(await session.load(), true);
  assert.equal(player.loadCalls, 2);
  assert.equal(session.status, 'ready');
  assert.equal(session.state.standard.selectedDifficulty, 'hard');

  assert.equal(await session.flush(), true);
  assert.deepEqual(journal.pending, []);
  const saved = (player.root.trifoldMeta as ReturnType<typeof createDefaultMetaSave>);
  assert.equal(saved.standard.selectedDifficulty, 'hard');
  assert.equal(saved.progression.receipts[pending.stream], pending.sequence);
});

test('failed flush preserves local state and pending journal for a later retry', async () => {
  const player = new FakePlayerStorage();
  player.root = { trifoldMeta: createDefaultMetaSave() };
  const journal = new MetaJournal('retry', new JournalStorage());
  const session = new MetaSession(player, journal);
  assert.equal(await session.load(), true);

  player.failSaves = 1;
  assert.equal(session.dispatch({ kind: 'set-standard-difficulty', difficulty: 'medium' }), true);
  assert.equal(session.state.standard.selectedDifficulty, 'medium');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(session.saveError, true);
  assert.equal(journal.pending.length, 1);

  assert.equal(await session.flush(), true);
  assert.equal(session.saveError, false);
  assert.deepEqual(journal.pending, []);
  assert.equal((player.root.trifoldMeta as ReturnType<typeof createDefaultMetaSave>).standard.selectedDifficulty, 'medium');
});

test('replaceAndFlush writes a forced normalized snapshot even with no journal operations', async () => {
  const player = new FakePlayerStorage();
  player.root = { other: 7, trifoldMeta: createDefaultMetaSave() };
  const session = new MetaSession(player, new MetaJournal('snapshot', new JournalStorage()));
  assert.equal(await session.load(), true);
  const next = { ...session.state, standard: { ...session.state.standard, selectedDifficulty: 'hard' as const } };
  assert.equal(await session.replaceAndFlush(next), true);
  assert.equal((player.root.trifoldMeta as ReturnType<typeof createDefaultMetaSave>).standard.selectedDifficulty, 'hard');
  assert.equal(player.root.other, 7);
});
