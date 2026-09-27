import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');

test('HomeScene keeps the frozen dashboard geometry and primary product cards', () => {
  for (const required of [
    'extends BaseUiScene', 'computeHomeLayout', 'ActionCard', 'SegmentedControl',
    'continuePrimary', 'difficultySelector', 'newDealAction', 'daily', 'mastery', 'leaders', 'serviceActions',
    'UI_TOKENS.asset.homeBackground',
  ]) assert.ok(scene.includes(required), `expected HomeScene to include ${required}`);
});

test('Home Standard actions and selected difficulty are routed through TrifoldProductBridge', () => {
  for (const required of [
    'productBridge.snapshot()', 'productBridge.resumeGame()', 'productBridge.startStandard', 'productBridge.setStandardDifficulty',
  ]) assert.ok(scene.includes(required), `expected HomeScene to include ${required}`);
  assert.equal(scene.includes('runtime.repository'), false);
  assert.equal(scene.includes('getRuntimeServices().repository'), false);
});

test('Home has one Leaders destination and no themes or coin UI', () => {
  assert.ok(scene.includes("this.navigation?.go('leaderboards')"));
  assert.equal(scene.includes("go('themes')"), false);
  assert.equal(scene.includes('CoinPill'), false);
  assert.equal((scene.match(/go\('leaderboards'\)/g) ?? []).length, 1);
});
