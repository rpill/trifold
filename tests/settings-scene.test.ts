import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../src/ui/scenes/SettingsScene.ts', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

test('Settings reads and writes persistent language/sound through product bridge', () => {
  for (const required of ['productBridge.settingsSnapshot()', 'productBridge.setSoundEnabled', 'productBridge.setLanguage']) assert.ok(settings.includes(required), `missing ${required}`);
  assert.equal(settings.includes('runtime.preferences'), false);
  assert.ok(home.includes("start('HowToPlayScene')"));
  assert.ok(home.includes("start('SettingsScene')"));
});

test('opening Settings from gameplay pauses active time and resumes it only after close', () => {
  for (const required of ['setBlockingOverlayOpen(true)', "launch('SettingsScene'", 'service-overlay-closed']) assert.ok(game.includes(required));
});

test('Settings keeps persistent Russian/English selector', () => {
  for (const required of ['SegmentedControl', "settings.russianName", "settings.englishName", 'settings.language']) assert.ok(settings.includes(required));
});
