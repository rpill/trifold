import test from 'node:test';
import assert from 'node:assert/strict';
import { computeThemesGridLayout } from '../src/ui/themes/ThemesGridLayout.ts';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';

for (const [name, width, height, touch, expectedColumns] of [
  ['desktop', 1920, 1080, false, 3],
  ['mobile 1280', 1280, 720, true, 2],
  ['mobile 844', 844, 390, true, 2],
] as const) {
  test(`${name} Themes grid uses ${expectedColumns} columns inside safe bounds`, () => {
    const viewport = resolveUiViewport({ width, height, touchPrimary: touch });
    const layout = computeThemesGridLayout(viewport, 7);
    assert.equal(layout.columns, expectedColumns);
    assert.ok(layout.content.x >= viewport.safeMargin);
    assert.ok(layout.content.y >= viewport.safeMargin);
    assert.ok(layout.content.x + layout.content.width <= viewport.width - viewport.safeMargin + 0.001);
    assert.ok(layout.content.y + layout.content.height <= viewport.height - viewport.safeMargin + 0.001);
    assert.equal(layout.cards.length, 7);
    for (const card of layout.cards) {
      assert.ok(card.width > 0 && card.height > 0);
      assert.ok(card.x >= 0 && card.x + card.width <= layout.content.width + 0.001);
    }
    if (expectedColumns === 2) assert.ok(layout.contentHeight >= layout.content.height);
  });
}
