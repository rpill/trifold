import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_THEME_ID, getLaunchThemes, getTheme } from '../src/theme/ThemeCatalog.ts';
import { createDefaultProfile, parsePlayerProfile } from '../src/meta/profile/ProfileSchema.ts';

test('launch catalog contains one free base and six paid 300-coin themes', () => {
  const themes = getLaunchThemes();
  assert.equal(themes.length, 7);
  assert.equal(themes.filter((theme) => theme.priceCoins === 0).length, 1);
  assert.equal(themes.filter((theme) => theme.priceCoins === 300).length, 6);
  assert.equal(themes[0]?.id, BASE_THEME_ID);
});

test('theme contract never exposes card-face or gameplay-geometry overrides', () => {
  const theme = getTheme(BASE_THEME_ID) as unknown as Record<string, unknown>;
  assert.equal('cardFaces' in theme, false);
  assert.equal('layout' in theme, false);
  assert.equal('dragons' in theme, false);
});

test('profile parser restores base, drops unknown theme ids and falls active theme back to base', () => {
  const profile = createDefaultProfile();
  const parsed = parsePlayerProfile({
    ...profile,
    ownedThemeIds: ['launch_03', 'missing', 'launch_03'],
    activeThemeId: 'missing',
  });
  assert.deepEqual(parsed.ownedThemeIds, ['base', 'launch_03']);
  assert.equal(parsed.activeThemeId, 'base');
});

test('profile parser preserves catalog order instead of persisted array order', () => {
  const profile = createDefaultProfile();
  const parsed = parsePlayerProfile({
    ...profile,
    ownedThemeIds: ['launch_06', 'launch_02', 'base', 'launch_02'],
    activeThemeId: 'launch_06',
  });
  assert.deepEqual(parsed.ownedThemeIds, ['base', 'launch_02', 'launch_06']);
  assert.equal(parsed.activeThemeId, 'launch_06');
});
