import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VISUAL_QA_FIXTURE_IDS,
  createVisualQaFixture,
  createVisualQaRuntime,
} from '../src/dev/visual-qa/fixtures/index.ts';

const required = [
  'home-fresh','home-progress',
  'game-short-columns','game-long-columns','game-free-cells-full',
  'game-dragons-red-ready','game-dragons-green-ready','game-dragons-white-ready',
  'game-auto-collect','game-hint','game-win',
  'daily-unsolved','daily-solved','daily-replay','daily-archive',
  'mastery-novice','mastery-mid','mastery-master','mastery-rank-up',
  'leaderboard-loading','leaderboard-own','leaderboard-empty','leaderboard-unavailable',
  'settings-ru','settings-en',
] as const;

test('fixture registry covers every required migrated product state', () => {
  for (const id of required) assert.ok(VISUAL_QA_FIXTURE_IDS.has(id), `missing fixture ${id}`);
});

test('fixtures are deterministic and return isolated object graphs', () => {
  for (const id of required) {
    const first = createVisualQaFixture(id);
    const second = createVisualQaFixture(id);
    assert.deepEqual(first, second, `${id} must be deterministic`);
    assert.notEqual(first, second);
    assert.notEqual(first.meta, second.meta);
  }
});

test('game fixtures contain real parseable active game saves for their declared poses', () => {
  for (const id of required.filter((value) => value.startsWith('game-'))) {
    const fixture = createVisualQaFixture(id);
    assert.equal(fixture.scene, 'GameScene');
    assert.ok(fixture.activeGame, `${id} needs an active game`);
    assert.equal(fixture.activeGame?.mode, 'standard');
    assert.equal(fixture.gamePose, id.slice('game-'.length));
  }
});

test('visual QA runtime uses only fixture-owned memory stores', async () => {
  const fixture = createVisualQaFixture('home-progress');
  const runtime = await createVisualQaRuntime(fixture);
  assert.deepEqual(runtime.services.metaSession.state, fixture.meta);
  assert.deepEqual(runtime.services.activeGames.load(), fixture.activeGame);
  assert.equal(runtime.services.preferences.language, fixture.preferences.language);
  assert.equal(runtime.services.preferences.soundEnabled, fixture.preferences.soundEnabled);
  assert.equal(runtime.storageWrites.realBrowser, 0);
});

test('leaderboard fixture platform states are explicit and reproducible', async () => {
  const own = await createVisualQaRuntime(createVisualQaFixture('leaderboard-own'));
  assert.equal(own.services.leaderboards.available, true);
  assert.equal(own.services.leaderboards.authorized, true);

  const unavailable = await createVisualQaRuntime(createVisualQaFixture('leaderboard-unavailable'));
  assert.equal(unavailable.services.leaderboards.available, false);
});
