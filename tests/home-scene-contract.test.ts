import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/HomeScene.ts', import.meta.url), 'utf8');

test('HomeScene uses the frozen dashboard geometry instead of a vertical menu', () => {
  for (const required of [
    'extends BaseUiScene', 'computeHomeLayout', 'ActionCard', 'SegmentedControl',
    'continuePrimary', 'newDealRow', 'daily', 'mastery', 'themes', 'serviceActions', 'coinPill',
    'UI_TOKENS.asset.homeBackground',
  ]) assert.ok(scene.includes(required), `expected HomeScene to include ${required}`);
  assert.equal(scene.includes('How to Play ActionCard'), false);
});

test('Home primary action resumes the save or starts selected difficulty directly', () => {
  assert.ok(scene.includes("mode: 'resume-standard'"));
  assert.ok(scene.includes("mode: 'new-standard'"));
  assert.ok(scene.includes('selectedStandardDifficulty'));
});


test('Home separates Continue from starting a selected new difficulty when a save exists', () => {
  for (const required of [
    'newDeal', 'startSelectedStandard', 'confirmNewDeal', 'selectedStandardDifficulty',
  ]) assert.ok(scene.includes(required), `expected HomeScene to include ${required}`);
  assert.ok(scene.includes("mode: 'resume-standard'"));
  assert.ok(scene.includes("mode: 'new-standard'"));
});
