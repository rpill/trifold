import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateViewportLayout, scaleViewportLayout } from '../src/game/view/ViewportLayout.ts';

test('scale 1 preserves the logical layout', () => {
  const logical = calculateViewportLayout(844, 390);
  assert.deepEqual(scaleViewportLayout(logical, 1), logical);
});

test('scale 2 doubles every board coordinate and dimension without changing profile', () => {
  const logical = calculateViewportLayout(844, 390);
  const scaled = scaleViewportLayout(logical, 2);
  assert.equal(scaled.profile, logical.profile);
  assert.equal(scaled.viewportWidth, logical.viewportWidth * 2);
  assert.equal(scaled.viewportHeight, logical.viewportHeight * 2);
  assert.equal(scaled.cardWidth, logical.cardWidth * 2);
  assert.equal(scaled.cardHeight, logical.cardHeight * 2);
  assert.deepEqual(scaled.tableauX, logical.tableauX.map((value) => value * 2));
  assert.equal(scaled.tableauY, logical.tableauY * 2);
  assert.deepEqual(scaled.freeCells, logical.freeCells.map((p) => ({ x: p.x * 2, y: p.y * 2 })));
  assert.deepEqual(scaled.foundations, logical.foundations.map((p) => ({ x: p.x * 2, y: p.y * 2 })));
  assert.deepEqual(scaled.flowerFoundation, { x: logical.flowerFoundation.x * 2, y: logical.flowerFoundation.y * 2 });
  assert.deepEqual(scaled.dragonControls, logical.dragonControls.map((r) => ({ x: r.x * 2, y: r.y * 2, width: r.width * 2, height: r.height * 2 })));
  assert.deepEqual(scaled.newDealControl, {
    x: logical.newDealControl.x * 2, y: logical.newDealControl.y * 2,
    width: logical.newDealControl.width * 2, height: logical.newDealControl.height * 2,
  });
  assert.deepEqual(scaled.undoControl, {
    x: logical.undoControl.x * 2, y: logical.undoControl.y * 2,
    width: logical.undoControl.width * 2, height: logical.undoControl.height * 2,
  });
  assert.deepEqual(scaled.dealOrigin, { x: logical.dealOrigin.x * 2, y: logical.dealOrigin.y * 2 });
});

test('844x390 at DPR 3 keeps logical compact layout but doubles card and drop geometry', async () => {
  const { planHiDpiCanvas } = await import('../src/render/HiDpiCanvas.ts');
  const plan = planHiDpiCanvas(844, 390, 3);
  assert.deepEqual(plan, {
    logicalWidth: 844,
    logicalHeight: 390,
    renderScale: 2,
    backingWidth: 1688,
    backingHeight: 780,
    cssZoom: 0.5,
  });

  const logical = calculateViewportLayout(plan.logicalWidth, plan.logicalHeight);
  const scaled = scaleViewportLayout(logical, plan.renderScale);
  assert.equal(logical.profile, 'compact-landscape');
  assert.equal(scaled.profile, 'compact-landscape');
  assert.equal(scaled.cardWidth, logical.cardWidth * 2);
  assert.equal(scaled.cardHeight, logical.cardHeight * 2);
});
