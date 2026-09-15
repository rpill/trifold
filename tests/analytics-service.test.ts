import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYTICS_EVENTS,
  AnalyticsService,
  normalizeAnalyticsPayload,
  type AnalyticsEvent,
} from '../src/analytics/AnalyticsService.ts';
import { createYandexMetricaSink, initializeYandexMetrica } from '../src/analytics/YandexMetrica.ts';

const expected: readonly AnalyticsEvent[] = [
  'first_run', 'standard_start', 'standard_win', 'standard_reset',
  'standard_difficulty_selected', 'daily_open', 'daily_start', 'daily_win',
  'daily_archive_open', 'daily_archive_win', 'streak_changed', 'mastery_rank_up',
  'hint_attempt', 'hint_success', 'reward_double_attempt', 'reward_double_success',
  'shop_open', 'theme_purchase', 'theme_apply', 'coin_pack_purchase',
  'leaderboard_open', 'auth_success', 'tutorial_start', 'tutorial_complete',
];

test('analytics exposes the exact approved release event schema', () => {
  assert.deepEqual(ANALYTICS_EVENTS, expected);
});

test('analytics payload normalization keeps safe primitives and drops invalid values', () => {
  const payload = normalizeAnalyticsPayload({
    difficulty: 'hard', moves: 42, activeMs: 12_345, assisted: false,
    badNumber: Number.NaN, missing: undefined, object: { nope: true },
  });
  assert.deepEqual(payload, { difficulty: 'hard', moves: 42, activeMs: 12_345, assisted: false });
});

test('analytics is no-op safe when sink is unavailable or throws', () => {
  assert.doesNotThrow(() => new AnalyticsService().track('first_run'));
  const analytics = new AnalyticsService({ send() { throw new Error('network'); } });
  assert.doesNotThrow(() => analytics.track('standard_win', { moves: 12 }));
});

test('Metrica sink queues until ym exists and flushes with reachGoal', () => {
  const calls: unknown[][] = [];
  let ym: ((...args: unknown[]) => void) | undefined;
  const sink = createYandexMetricaSink(123, () => ym);
  assert.ok(sink);
  sink.send('first_run', {});
  assert.equal(calls.length, 0);
  ym = (...args: unknown[]) => { calls.push(args); };
  sink.send('standard_win', { difficulty: 'hard', moves: 42 });
  assert.deepEqual(calls, [
    [123, 'reachGoal', 'first_run', {}],
    [123, 'reachGoal', 'standard_win', { difficulty: 'hard', moves: 42 }],
  ]);
});


test('Metrica initialization loads tag script once and queues init before the library arrives', () => {
  let ym: ((...args: unknown[]) => void) | undefined;
  const loaded: string[] = [];
  const environment = {
    getYm: () => ym,
    setYm: (next: (...args: unknown[]) => void) => { ym = next; },
    loadScript: (src: string) => { loaded.push(src); },
  };
  assert.equal(initializeYandexMetrica(123, environment), true);
  assert.equal(initializeYandexMetrica(123, environment), true);
  assert.deepEqual(loaded, ['https://mc.yandex.ru/metrika/tag.js']);
  const queued = (ym as ((...args: unknown[]) => void) & { a?: unknown[][] } | undefined)?.a ?? [];
  assert.deepEqual(queued, [[123, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true }]]);
});
