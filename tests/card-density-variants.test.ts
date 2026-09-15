import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('runtime generated card faces expose 1x and 2x density variants', () => {
  const assets = source('src/game/view/CardFaceAssets.ts');
  const card = source('src/game/view/SchematicCardView.ts');

  assert.ok(assets.includes("'/assets/cards/generated/1x'"), '1x generated root should be loaded');
  assert.ok(assets.includes("'/assets/cards/generated/2x'"), '2x generated root should be loaded');
  assert.ok(assets.includes('cardFaceDensityForRenderScale'), 'runtime should choose a density from render scale');
  assert.ok(card.includes('setTexture'), 'existing card images should swap density on relayout');
});
