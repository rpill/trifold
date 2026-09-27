import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const overlayPath = 'src/ui/win/WinOverlay.ts';
const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');

test('reusable WinOverlay exposes result actions without economy or platform SDK coupling', () => {
  assert.equal(existsSync(overlayPath), true, 'WinOverlay.ts must exist');
  const source = readFileSync(overlayPath, 'utf8');
  for (const required of [
    'export interface WinOverlayContent',
    'export interface WinOverlayActions',
    'export class WinOverlay',
    'newDeal',
    'home',
    'layout(layout: ViewportLayout)',
    'destroy()',
  ]) assert.ok(source.includes(required), `expected WinOverlay to include ${required}`);
  for (const forbidden of [
    'YaGames', 'ysdk', 'rewarded', 'showRewardedVideo',
    'doubleCoins', 'rewardAction', 'rewardLine', 'common.coins', 'win.doubleCoins',
  ]) assert.equal(source.includes(forbidden), false, `WinOverlay must not contain removed product concept: ${forbidden}`);
});

test('GameScene delegates victory rendering without reward-double flow', () => {
  for (const required of [
    "import { WinOverlay",
    'buildStandardWinViewModel',
    'buildStandardWinOverlayContent',
    'private victoryOverlay: WinOverlay | null',
    'new WinOverlay(',
    '.layout(layout)',
  ]) assert.ok(scene.includes(required), `expected GameScene to include ${required}`);

  for (const forbidden of ['RewardDouble', 'claimStandardRewardDouble', 'rewardedAds', 'showRewarded']) {
    assert.equal(scene.includes(forbidden), false, `GameScene must not contain ${forbidden}`);
  }
  assert.equal(scene.includes('Phaser.GameObjects.Container | null'), false, 'legacy manual victory container must be removed');
  assert.equal(scene.includes("this.add.text(0, 0, 'Новая раздача'"), false, 'legacy manual win buttons must be removed');
});
