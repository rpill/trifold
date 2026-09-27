import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const visibleUiFiles = [
  '../src/ui/scenes/HomeScene.ts',
  '../src/ui/scenes/DailyScene.ts',
  '../src/ui/scenes/SettingsScene.ts',
  '../src/ui/scenes/HowToPlayScene.ts',
  '../src/ui/scenes/MasteryScene.ts',
  '../src/ui/scenes/LeaderboardsScene.ts',
  '../src/ui/game/GameHud.ts',
  '../src/game/scenes/GameScene.ts',
] as const;

test('visible UI scenes keep Russian copy in localization helpers instead of hard-coded scene strings', () => {
  for (const path of visibleUiFiles) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal(/[А-Яа-яЁё]/.test(source), false, `${path} still contains hard-coded Cyrillic UI copy`);
  }
});

test('localization contains no removed Themes/shop/currency reward copy', () => {
  const source = readFileSync(new URL('../src/i18n/Localization.ts', import.meta.url), 'utf8');
  for (const forbidden of [
    "'common.coins'", "'common.bonusAd'", "'home.themes'", "'daily.reward'",
    "'mastery.rankReward'", "'themes.", "'win.rankReward'", "'win.rewardClaimed'",
    "'win.doubleCoins'", 'themeDisplayName',
  ]) assert.equal(source.includes(forbidden), false, `localization still contains ${forbidden}`);
});
