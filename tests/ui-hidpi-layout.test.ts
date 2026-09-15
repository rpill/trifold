import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as viewportModule from '../src/ui/layout/UiViewport.ts';
import { computeHomeLayout } from '../src/ui/layout/HomeLayout.ts';

test('UI scenes use GameScene-style backing coordinates with camera zoom 1', () => {
  const source = readFileSync(new URL('../src/ui/scenes/BaseUiScene.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('.setZoom(1)'), 'UI camera must stay at zoom 1 like GameScene');
  assert.equal(source.includes('.setZoom(renderScale)'), false, 'UI must not double-apply render scale through camera zoom');
  assert.ok(source.includes('scaleUiViewportForBacking'), 'UI layout must scale logical CSS geometry into backing pixels');
});

test('844x390 DPR2 Home keeps approved composition and 44 CSS px targets after backing scaling', () => {
  const scaleFn = (viewportModule as Record<string, unknown>).scaleUiViewportForBacking;
  assert.equal(typeof scaleFn, 'function', 'scaleUiViewportForBacking must exist');
  if (typeof scaleFn !== 'function') return;

  const logical = viewportModule.resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  const backing = (scaleFn as (value: typeof logical, renderScale: number) => typeof logical)(logical, 2);
  assert.equal(backing.width, 1688);
  assert.equal(backing.height, 780);
  assert.equal(backing.minTouchTarget, 88);

  const layout = computeHomeLayout(backing);
  assert.ok(layout.brand.x >= 0);
  assert.ok(layout.brand.x + layout.brand.width <= backing.width);
  assert.ok(layout.dashboard.x >= layout.brand.x + layout.brand.width);
  assert.ok(layout.dashboard.x + layout.dashboard.width <= backing.width);
  assert.ok(layout.serviceActions.height >= 88);
});
