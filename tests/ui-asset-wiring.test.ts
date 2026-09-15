import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredIcons = [
  'home', 'new-deal', 'undo', 'hint', 'settings',
  'leaderboard', 'how-to-play', 'coin', 'daily', 'mastery', 'themes',
] as const;

test('production UI icon assets are bundled under public/assets/ui/icons', () => {
  for (const name of requiredIcons) {
    const path = `public/assets/ui/icons/${name}.svg`;
    assert.equal(existsSync(path), true, `${path} must exist`);
    const source = readFileSync(path, 'utf8');
    assert.match(source, /viewBox="0 0 24 24"/);
  }
});

test('BootScene preloads the shared UI asset registry before routing', () => {
  const boot = readFileSync('src/ui/scenes/BootScene.ts', 'utf8');
  assert.ok(boot.includes('preloadUiAssets'));
  assert.match(boot, /preload\(\): void/);
});

test('Home service actions use prepared SVG icon keys instead of text glyphs', () => {
  const home = readFileSync('src/ui/scenes/HomeScene.ts', 'utf8');
  assert.ok(home.includes('UI_ICON_KEYS.leaderboard'));
  assert.ok(home.includes('UI_ICON_KEYS.howToPlay'));
  assert.ok(home.includes('UI_ICON_KEYS.settings'));
  assert.equal(home.includes("glyph: '★'"), false);
  assert.equal(home.includes("glyph: '?'"), false);
  assert.equal(home.includes("glyph: '⚙'"), false);
});

test('Game HUD assigns prepared icons to every primary action', () => {
  const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  for (const key of ['home', 'newDeal', 'undo', 'hint', 'settings'] as const) {
    assert.ok(hud.includes(`UI_ICON_KEYS.${key}`), `expected GameHud to use UI_ICON_KEYS.${key}`);
  }
  assert.ok(hud.includes('Phaser.GameObjects.Image'));
});

test('coin displays use the prepared coin icon rather than a text bullet', () => {
  const pill = readFileSync('src/ui/components/CoinPill.ts', 'utf8');
  const hud = readFileSync('src/ui/game/GameHud.ts', 'utf8');
  assert.ok(pill.includes('UI_ICON_KEYS.coin'));
  assert.ok(pill.includes('Phaser.GameObjects.Image'));
  assert.equal(hud.includes("setText(`● ${this.viewModel.coins}`)"), false);
});
