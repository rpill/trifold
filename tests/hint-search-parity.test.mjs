import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { findWinningProof } from '../src/game/hints/HintSearch.ts';

const solver = resolve('tools', process.platform === 'win32' ? 'trifold_solver.exe' : 'trifold_solver');

test('runtime hint solver agrees semantically with the native solver on frozen seeds', () => {
  assert.ok(existsSync(solver), `native solver missing at ${solver}`);
  for (const seed of [1, 2, 3]) {
    const native = JSON.parse(execFileSync(solver, ['--seed', String(seed), '--budget', '300000', '--proof-json'], { encoding: 'utf8' }));
    assert.equal(native.status, 'SOLVED', `native seed ${seed}`);

    const game = new TrifoldGame(createDeal(seed));
    game.settleInitialAutoMoves();
    const snapshot = game.snapshot();
    const runtime = findWinningProof(snapshot, { maxNodes: 300_000 });
    assert.equal(runtime.status, 'SOLVED', `runtime seed ${seed}`);
    if (runtime.status !== 'SOLVED') continue;
    assert.ok(runtime.proof.length > 0);

    const replay = TrifoldGame.restore({ version: 1, seed, snapshot, history: { version: 1, entries: [] } });
    assert.ok(replay.perform(runtime.proof[0]), `runtime seed ${seed} first command must be legal`);
    for (const command of runtime.proof.slice(1)) assert.ok(replay.perform(command));
    assert.equal(replay.state.foundations.coins.length + replay.state.foundations.bamboo.length + replay.state.foundations.characters.length, 27);
  }
});
