import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../src/ui/scenes/SettingsScene.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('Settings persists sfxEnabled and Home service buttons route to How to Play and Settings', () => {
  assert.ok(settings.includes('sfxEnabled'));
  assert.ok(settings.includes('repository.mutate'));
  assert.ok(home.includes("start('HowToPlayScene')"));
  assert.ok(home.includes("start('SettingsScene')"));
});

test('opening Settings from gameplay pauses active time and resumes it only after close', () => {
  for (const required of ['setBlockingOverlayOpen(true)', "launch('SettingsScene'", 'service-overlay-closed']) {
    assert.ok(game.includes(required), `expected GameScene to include ${required}`);
  }
});


test('Settings exposes a persistent Russian/English language selector', () => {
  for (const required of ['SegmentedControl', "settings.russianName", "settings.englishName", 'settings.language', 'runtime.language']) {
    assert.ok(settings.includes(required), `expected Settings language UI to include ${required}`);
  }
});
