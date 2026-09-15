import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const runtime = source('../src/meta/RuntimeServices.ts');
const game = source('../src/game/scenes/GameScene.ts');
const home = source('../src/ui/scenes/HomeScene.ts');
const daily = source('../src/ui/scenes/DailyScene.ts');
const themes = source('../src/ui/scenes/ThemesScene.ts');
const boards = source('../src/ui/scenes/LeaderboardsScene.ts');
const main = source('../src/main.ts');

test('runtime owns a no-op-safe AnalyticsService and main configures Metrica', () => {
  assert.match(runtime, /AnalyticsService/);
  assert.match(runtime, /analytics:/);
  assert.match(main, /createYandexMetricaSink/);
  assert.match(main, /first_run/);
});

test('gameplay emits start win reset rewarded and mastery analytics at committed boundaries', () => {
  for (const event of ['standard_start', 'standard_win', 'standard_reset', 'daily_start', 'daily_win', 'daily_archive_win', 'reward_double_attempt', 'reward_double_success', 'mastery_rank_up']) {
    assert.match(game, new RegExp(`['\"]${event}['\"]`));
  }
});

test('UI scenes emit approved navigation economy and auth analytics', () => {
  assert.match(home, /standard_difficulty_selected/);
  assert.match(daily, /daily_open/);
  assert.match(daily, /daily_archive_open/);
  assert.match(themes, /shop_open/);
  assert.match(themes, /theme_purchase/);
  assert.match(themes, /theme_apply/);
  assert.match(themes, /coin_pack_purchase/);
  assert.match(boards, /leaderboard_open/);
  assert.match(boards, /auth_success/);
});
