import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('GameScene converts logical viewport geometry to backing-store geometry exactly once', () => {
  for (const required of [
    'calculateViewportLayout',
    'scaleViewportLayout',
    'const cssZoom = this.scale.zoom',
    'renderScale',
    '.setZoom(1)',
    'this.input.dragDistanceThreshold = 7',
    'board.relayout',
    "this.scale.on('resize'",
  ]) {
    assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  }
});

test('GameScene wires StandardSessionController, controls, SFX preload and committed victory flow', () => {
  for (const required of [
    'StandardSessionController', 'getRuntimeServices', 'GameHud', 'buildGameHudViewModel', 'startNewStandard', 'requestUndo', 'collectDragons',
    'SfxController', 'SFX_ASSETS', 'loaderror', 'missingSfxKeys', 'const sound = this.sound', 'return sound.locked',
    "this.sfx?.play('victory')", 'session.settleWin', 'RD', 'GD', 'BD',
    "this.createControl(DRAGON_LABELS[family]",
  ]) {
    assert.ok(scene.includes(required), `expected GameScene to include ${required}`);
  }
  assert.equal(scene.includes('dealSource.nextSeed'), false);
  assert.equal(scene.includes('Math.random()'), false);
});


test('dragon buttons use a persistent dull-yellow style and brighten only when collectable', () => {
  for (const required of ['variant', "'dragon'", '0x8b7430', '0xd7b84d', 'canCollectDragons']) {
    assert.ok(scene.includes(required), `expected dragon control styling to include ${required}`);
  }
});


test('completed dragon family uses a darker third visual state', () => {
  for (const required of [
    'completed: boolean',
    "cell.kind === 'dragons' && cell.family === family",
    '0x4f4524',
    'control.completed = completed',
  ]) {
    assert.ok(scene.includes(required), `expected completed dragon styling to include ${required}`);
  }
});

test('GameScene supports Daily sessions without exposing hints or random Daily seeds', () => {
  for (const required of [
    'DailySessionController', "'new-daily'", "'resume-daily'", 'startNewDaily', 'resumeDaily',
    'buildDailyWinOverlayContent',
  ]) assert.ok(scene.includes(required), `expected Daily wiring to include ${required}`);
  assert.equal(scene.includes('getDailySeedByOffset(random'), false);
});

test('GameScene wires free solver hints only for Standard sessions and disables unavailable hints', () => {
  for (const required of [
    'HintWorkerClient', 'HintCoordinator', 'requestHint', 'hintBusy',
    "runtime.analytics.track('hint_attempt'", "runtime.analytics.track('hint_success'",
    'this.board?.showHint(command)', 'isUnavailableForCurrentState()',
  ]) assert.ok(scene.includes(required), `expected Standard hint wiring to include ${required}`);
  assert.ok(scene.includes('session instanceof DailySessionController'));
  assert.equal(scene.includes('getRuntimeServices().rewardedAds.available && !this.hintBusy'), false);
  const coordinator = readFileSync(new URL('../src/meta/hints/HintCoordinator.ts', import.meta.url), 'utf8');
  assert.ok(coordinator.includes('this.session.markAssisted()'));
  assert.equal(coordinator.includes('showRewarded'), false, 'Standard hints must not show rewarded ads');
  assert.equal(coordinator.includes('RewardedAdGateway'), false, 'Standard hints must not depend on ad gateway');
});
