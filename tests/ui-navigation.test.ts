import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE_SCENES, type UiRoute } from '../src/ui/navigation/UiRoute.ts';
import { NavigationController } from '../src/ui/navigation/NavigationController.ts';

const routes: readonly UiRoute[] = ['home', 'standard', 'daily', 'mastery', 'themes', 'leaderboards'];

test('every major route maps to exactly one Phaser scene key', () => {
  assert.deepEqual(Object.keys(ROUTE_SCENES).sort(), [...routes].sort());
  assert.equal(ROUTE_SCENES.home, 'HomeScene');
  assert.equal(ROUTE_SCENES.standard, 'GameScene');
  assert.equal(ROUTE_SCENES.daily, 'DailyScene');
  assert.equal(ROUTE_SCENES.mastery, 'MasteryScene');
  assert.equal(ROUTE_SCENES.themes, 'ThemesScene');
  assert.equal(ROUTE_SCENES.leaderboards, 'LeaderboardsScene');
});

test('overlays are not major routes', () => {
  for (const overlay of ['settings', 'how-to-play', 'win', 'tutorial', 'hint']) {
    assert.equal(overlay in ROUTE_SCENES, false);
  }
});

test('home always starts HomeScene and standard payload passes through unchanged', () => {
  const starts: Array<{ key: string; data: unknown }> = [];
  const navigation = new NavigationController({
    start: (key, data) => starts.push({ key, data }),
  });

  navigation.home();
  navigation.go('standard', { mode: 'continue' });
  navigation.go('standard', { mode: 'new-deal', difficulty: 'hard' });

  assert.deepEqual(starts, [
    { key: 'HomeScene', data: undefined },
    { key: 'GameScene', data: { mode: 'continue' } },
    { key: 'GameScene', data: { mode: 'new-deal', difficulty: 'hard' } },
  ]);
});

import { readFileSync } from 'node:fs';

test('BaseUiScene reuses Phaser resize/HiDPI scale and exposes one resolved UI viewport', () => {
  const source = readFileSync('src/ui/scenes/BaseUiScene.ts', 'utf8');
  assert.ok(source.includes("this.scale.on('resize'"));
  assert.ok(source.includes('resolveUiViewport'));
  assert.ok(source.includes('this.scale.zoom'));
  assert.ok(source.includes('setZoom(1)'));
  assert.ok(source.includes('scaleUiViewportForBacking'));
  assert.equal(source.includes('setZoom(renderScale)'), false);
  assert.equal(source.includes('ResizeObserver'), false);
});
