import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVisualQaCatalog,
  type VisualQaScenario,
} from '../src/dev/visual-qa/VisualQaCatalog.ts';
import { VISUAL_QA_VIEWPORT_PRESETS } from '../src/dev/visual-qa/viewportPresets.ts';

const fixtures = new Set(['home-fresh', 'game-win']);

function scenario(overrides: Partial<VisualQaScenario> = {}): VisualQaScenario {
  return {
    id: 'home-fresh',
    scene: 'HomeScene',
    fixture: 'home-fresh',
    viewports: 'all',
    ...overrides,
  };
}

test('catalog accepts a valid scenario and all required viewport presets exist', () => {
  const result = validateVisualQaCatalog([scenario()], {
    fixtureIds: fixtures,
    viewportIds: new Set(Object.keys(VISUAL_QA_VIEWPORT_PRESETS)),
  });
  assert.deepEqual(result, []);
  for (const id of ['1920x1080', '1366x768', '1280x640', '844x390-touch', '915x412-touch']) {
    assert.ok(VISUAL_QA_VIEWPORT_PRESETS[id], `missing preset ${id}`);
  }
  assert.equal(VISUAL_QA_VIEWPORT_PRESETS['844x390-touch'].touchPrimary, true);
  assert.equal(VISUAL_QA_VIEWPORT_PRESETS['1920x1080'].touchPrimary, false);
});

test('catalog rejects duplicate scenario ids', () => {
  const errors = validateVisualQaCatalog([scenario(), scenario()], {
    fixtureIds: fixtures,
    viewportIds: new Set(Object.keys(VISUAL_QA_VIEWPORT_PRESETS)),
  });
  assert.ok(errors.some((error) => error.includes('duplicate scenario id')));
});

test('catalog rejects unknown fixture and viewport references', () => {
  const errors = validateVisualQaCatalog([
    scenario({ fixture: 'missing-fixture', viewports: ['missing-viewport'] }),
  ], {
    fixtureIds: fixtures,
    viewportIds: new Set(Object.keys(VISUAL_QA_VIEWPORT_PRESETS)),
  });
  assert.ok(errors.some((error) => error.includes('unknown fixture')));
  assert.ok(errors.some((error) => error.includes('unknown viewport')));
});

test('catalog rejects malformed declarative interactions', () => {
  const errors = validateVisualQaCatalog([
    scenario({ interactions: [
      { type: 'click', target: '' },
      { type: 'drag', from: 'card-a', to: '' },
      { type: 'swipe', direction: 'diagonal' as never },
      { type: 'wait-ready', marker: '' },
    ] }),
  ], {
    fixtureIds: fixtures,
    viewportIds: new Set(Object.keys(VISUAL_QA_VIEWPORT_PRESETS)),
  });
  assert.equal(errors.filter((error) => error.includes('interaction')).length, 4);
});

test('production visual QA catalog exposes every fixture as a capture scenario', async () => {
  const { VISUAL_QA_SCENARIOS } = await import('../src/dev/visual-qa/VisualQaCatalog.ts');
  const ids = new Set(VISUAL_QA_SCENARIOS.map((item) => item.id));
  for (const id of [
    'home-fresh','home-progress','game-short-columns','game-long-columns','game-free-cells-full',
    'game-dragons-red-ready','game-dragons-green-ready','game-dragons-white-ready','game-auto-collect','game-hint','game-win',
    'daily-unsolved','daily-solved','daily-replay','daily-archive',
    'mastery-novice','mastery-mid','mastery-master','mastery-rank-up',
    'leaderboard-loading','leaderboard-own','leaderboard-empty','leaderboard-unavailable','settings-ru','settings-en',
  ]) assert.ok(ids.has(id), `missing capture scenario ${id}`);
  assert.ok(VISUAL_QA_SCENARIOS.every((item) => item.viewports === 'all'));
});
