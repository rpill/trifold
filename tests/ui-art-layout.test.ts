import test from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop } from '../src/ui/assets/ArtworkLayout.ts';
import { computeHomeLayout } from '../src/ui/layout/HomeLayout.ts';
import { resolveUiViewport, scaleUiViewportForBacking } from '../src/ui/layout/UiViewport.ts';

test('artwork cover crop preserves aspect and stays inside the source', () => {
  for (const target of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }, { width: 250, height: 600 }]) {
    const crop = coverCrop(1536, 1024, target.width, target.height, 0, 0.5);
    assert.ok(Math.abs(crop.width / crop.height - target.width / target.height) < 0.001);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1536.001 && crop.y + crop.height <= 1024.001);
    assert.equal(crop.x, 0, 'left focal point keeps the landscape visible');
  }
});

for (const width of [667, 844, 1280]) {
  test(`home controls fit without touching the next row at ${width}`, () => {
    const viewport = resolveUiViewport({ width, height: width === 1280 ? 720 : 375, touchPrimary: true });
    const home = computeHomeLayout(viewport);
    assert.ok(home.newDealRow.y + home.newDealRow.height + 4 <= home.daily.y);
    assert.ok(home.continuePrimary.height >= 44);
    assert.ok(home.difficultySelector.width / 3 >= 44);
    const doubled = computeHomeLayout(scaleUiViewportForBacking(viewport, 2));
    assert.ok(Math.abs(doubled.daily.y / 2 - home.daily.y) <= 1, 'DPR must not change CSS geometry');
  });
}
