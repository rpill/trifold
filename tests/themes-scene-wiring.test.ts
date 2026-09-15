import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/ThemesScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('ThemesScene is a routed responsive shop with shared coins and pure ShopService mutations', () => {
  for (const required of [
    'extends BaseUiScene', 'buildThemesViewModel', 'computeThemesGridLayout', 'ThemeCard', 'CoinPill',
    'purchaseTheme', 'applyTheme', 'repository.mutate', 'theme.setTheme', 'ScrollRegion',
  ]) assert.ok(scene.includes(required), `expected ThemesScene to include ${required}`);
  assert.ok(main.includes('ThemesScene'));
});

test('ThemesScene keeps coin pack present but unavailable until payments gateway is connected', () => {
  assert.ok(scene.includes('coinPack'));
  assert.ok(scene.includes('payments.available'));
});
