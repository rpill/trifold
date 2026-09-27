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
const boards = source('../src/ui/scenes/LeaderboardsScene.ts');
const main = source('../src/main.ts');

test('runtime owns a no-op-safe AnalyticsService and main configures Metrica', () => {
  assert.match(runtime, /AnalyticsService/);
  assert.match(runtime, /analytics:/);
  assert.match(main, /createYandexMetricaSink/);
  assert.match(main, /first_run/);
});

test('gameplay emits product progress analytics without removed reward-double events', () => {
  for (const event of ['standard_start', 'standard_win', 'standard_reset', 'daily_start', 'daily_win', 'daily_archive_win', 'mastery_rank_up']) {
    assert.match(game, new RegExp(`['\"]${event}['\"]`));
  }
  for (const removed of ['reward_double_attempt', 'reward_double_success']) {
    assert.doesNotMatch(game, new RegExp(`['\"]${removed}['\"]`));
  }
});

test('UI scenes emit navigation and auth analytics without shop/theme/purchase events', () => {
  assert.match(home, /standard_difficulty_selected/);
  assert.match(daily, /daily_open/);
  assert.match(daily, /daily_archive_open/);
  assert.match(boards, /leaderboard_open/);
  assert.match(boards, /auth_success/);
  const shippingUi = [home, daily, boards, main].join('\n');
  for (const removed of ['shop_open', 'theme_purchase', 'theme_apply', 'coin_pack_purchase']) {
    assert.doesNotMatch(shippingUi, new RegExp(`['\"]${removed}['\"]`));
  }
});


test('analytics contract contains no removed economy/theme events and includes interstitial outcomes', () => {
  const analytics = source('../src/analytics/AnalyticsService.ts');
  for (const required of ['fullscreen_requested','fullscreen_shown','fullscreen_not_shown']) {
    assert.match(analytics, new RegExp(`['"]${required}['"]`));
  }
  for (const removed of ['shop_open','theme_purchase','theme_apply','coin_pack_purchase','reward_double_attempt','reward_double_success']) {
    assert.doesNotMatch(analytics, new RegExp(`['"]${removed}['"]`));
  }
});
