import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const yandex = readFileSync(new URL('../src/platform/yandex.ts', import.meta.url), 'utf8');

test('leaderboard UI exposes only Daily Streak and Mastery release tabs', () => {
  assert.match(source, /Daily/);
  assert.match(source, /leaderboards\.streak/);
  assert.match(source, /Mastery/);
  for (const forbidden of ['Standard Easy', 'Standard Medium', 'Standard Hard']) {
    assert.equal(source.includes(forbidden), false);
  }
});

test('leaderboard auth explicitly connects cloud after user action', () => {
  assert.match(source, /requestAuthorization\(\)/);
  assert.match(source, /connectCloud/);
  assert.match(source, /leaderboards\.signIn/);
});

test('Home enables routed leaderboard scene through runtime capability', () => {
  assert.match(home, /leaderboards\.available/);
  assert.match(main, /LeaderboardsScene/);
});

test('wins schedule leaderboard sync without owning gameplay state', () => {
  assert.match(game, /leaderboards\.syncFromProfile/);
});

test('anonymous leaderboard player label is localized at the UI boundary', () => {
  assert.equal(yandex.includes('Игрок'), false);
  assert.match(source, /leaderboards\.player/);
});


test('leaderboard sign-in reflects auth availability and locks while authorization is running', () => {
  assert.match(source, /auth\.available/);
  assert.match(source, /authorizing/);
  assert.match(source, /updateSignInState/);
});

test('successful sign-in updates auth UI before cloud follow-up work', () => {
  const authUi = source.indexOf('this.updateSignInState');
  const cloud = source.indexOf('connectCloud');
  assert.ok(authUi >= 0, 'auth UI update should exist');
  assert.ok(cloud >= 0, 'cloud connect should exist');
  assert.ok(authUi < cloud, 'auth UI must update before cloud merge starts');
});


test('authorized leaderboard scene fully hides sign-in card and its hit target', () => {
  assert.match(source, /signIn\.setVisible/);
  assert.match(source, /auth\.isAuthorized\(\)/);
});

test('leaderboard rows use tab-aware display formatting instead of raw composite scores', () => {
  assert.match(source, /formatLeaderboardValue/);
  assert.equal(source.includes('`${entry.rank}. ${playerName}   ${entry.score}`'), false);
});
