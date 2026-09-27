import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/scenes/LeaderboardsScene.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const yandex = readFileSync(new URL('../src/platform/yandex.ts', import.meta.url), 'utf8');

test('leaderboard UI exposes only Daily Streak and Mastery tabs', () => {
  assert.match(source,/Daily/); assert.match(source,/leaderboards\.streak/); assert.match(source,/Mastery/);
  for (const forbidden of ['Standard Easy','Standard Medium','Standard Hard']) assert.equal(source.includes(forbidden),false);
});

test('leaderboard scene uses product bridge for load and authorization with no legacy cloud repository', () => {
  for (const required of ['productBridge.leaderboardSnapshot()', 'productBridge.loadLeaderboard', 'productBridge.authorizeLeaderboard()']) {
    assert.ok(source.includes(required), `expected ${required}`);
  }
  for (const forbidden of ['connectCloud','syncFromProfile','runtime.repository','runtime.platform.auth','loadDaily(','loadStreak(','loadMastery(']) {
    assert.equal(source.includes(forbidden), false, `legacy leaderboard path remains: ${forbidden}`);
  }
});

test('Home has one routed Leaders destination and game settlement uses product leaderboard sync', () => {
  assert.equal((home.match(/go\('leaderboards'\)/g) ?? []).length,1);
  assert.match(main,/LeaderboardsScene/);
  assert.match(game,/syncProductLeaderboards/);
});

test('anonymous leaderboard player label is localized at the UI boundary', () => {
  assert.equal(yandex.includes('Игрок'),false);
  assert.match(source,/leaderboards\.player/);
});

test('leaderboard sign-in visibility and disabled state come from bridge auth snapshot', () => {
  assert.match(source,/authorizing/);
  assert.match(source,/updateSignInState/);
  assert.match(source,/authorizationAllowed/);
});

test('leaderboard rows use tab-aware display formatting', () => {
  assert.match(source,/formatLeaderboardValue/);
});
