import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_ASPECT_RATIO, calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';
import { tableauCardY } from '../src/game/view/layout.ts';

type Rect = { x: number; y: number; width: number; height: number };
function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function cardRect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height };
}

function assertInside(inner: Rect, outer: Rect): void {
  assert.ok(inner.x >= outer.x - 1e-6);
  assert.ok(inner.y >= outer.y - 1e-6);
  assert.ok(inner.x + inner.width <= outer.x + outer.width + 1e-6);
  assert.ok(inner.y + inner.height <= outer.y + outer.height + 1e-6);
}

test('card geometry uses the new taller production face ratio', () => {
  const expectedRatio = 1353 / 868;
  assert.ok(Math.abs(CARD_ASPECT_RATIO - expectedRatio) < 1e-9);

  for (const [width, height] of [[844, 390], [1280, 720], [1744, 864]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - expectedRatio) < 1e-9);
    assert.ok(layout.cardHeight > layout.cardWidth * 1.55, `${width}x${height}: card is still too squat`);
  }
});

for (const [width, height, profile] of [[844,390,'compact-landscape'], [1280,720,'standard']] as const) {
  test(`${width}x${height} creates complete non-overlapping board geometry`, () => {
    const layout = calculateViewportLayout(width, height);
    assert.equal(layout.profile, profile);
    assert.equal(layout.tableauX.length, 8);
    assert.equal(layout.freeCells.length, 3);
    assert.equal(layout.foundations.length, 3);
    assert.equal(layout.dragonControls.length, 3);
    assert.ok(layout.cardWidth > 0);
    assert.ok(layout.cardHeight > 0);

    const tableauRects = layout.tableauX.map((x) => cardRect(x, layout.tableauY, layout.cardWidth, layout.cardHeight));
    for (const rect of tableauRects) assertInside(rect, layout.boardBounds);
    for (let i = 1; i < tableauRects.length; i += 1) {
      assert.equal(intersects(tableauRects[i - 1], tableauRects[i]), false);
    }

    const topCards = [
      ...layout.freeCells.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
      cardRect(layout.flowerFoundation.x, layout.flowerFoundation.y, layout.cardWidth, layout.cardHeight),
      ...layout.foundations.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
    ];
    for (let i = 0; i < topCards.length; i += 1) {
      for (let j = i + 1; j < topCards.length; j += 1) assert.equal(intersects(topCards[i], topCards[j]), false);
    }

    for (const tableau of tableauRects) {
      assert.equal(intersects(tableau, layout.newDealControl), false);
      assert.equal(intersects(tableau, layout.undoControl), false);
    }

    const firstFoundation = layout.foundations[0];
    assert.ok(firstFoundation);
    assert.ok(firstFoundation.x - (layout.flowerFoundation.x + layout.cardWidth) >= (layout.profile === 'compact-landscape' ? 8 : 14), 'F/deal slot should be visually separated from numeric foundations');
  });
}

test('deal origin is the flower slot and is separated from the three numeric foundations', () => {
  for (const [width, height] of [[844, 390], [1280, 720]] as const) {
    const layout = calculateViewportLayout(width, height);
    assert.equal(layout.dealOrigin.x, layout.flowerFoundation.x);
    assert.equal(layout.dealOrigin.y, layout.flowerFoundation.y);
    const firstFoundation = layout.foundations[0];
    assert.ok(firstFoundation);
    const gap = firstFoundation.x - (layout.flowerFoundation.x + layout.cardWidth);
    assert.ok(gap >= (layout.profile === 'compact-landscape' ? 8 : 14));
  }
});

test('standard cards are at least as wide as compact cards', () => {
  const compact = calculateViewportLayout(844, 390);
  const standard = calculateViewportLayout(1280, 720);
  assert.ok(standard.cardWidth >= compact.cardWidth);
});

test('wide low-height desktop viewport stays on the standard profile', () => {
  const layout = calculateViewportLayout(1258, 475);
  assert.equal(layout.profile, 'standard');
  assert.ok(layout.cardWidth >= 110, `desktop cards are too small: ${layout.cardWidth}`);
});

test('vertical fan compression keeps long columns inside board bottom margin', () => {
  for (const [width, height] of [[844,390], [1280,720]] as const) {
    const layout = calculateViewportLayout(width, height);
    const y = tableauCardY(layout, 14, 13);
    const bottom = y + layout.cardHeight;
    const limit = layout.boardBounds.y + layout.boardBounds.height - layout.bottomMargin;
    assert.ok(bottom <= limit + 1e-6, `${width}x${height}: ${bottom} > ${limit}`);
  }
});

test('abrupt landscape resize sequence always produces valid fresh geometry', () => {
  const sequence = [[844, 390], [1280, 720], [760, 360], [844, 390]] as const;
  for (const [width, height] of sequence) {
    const layout = calculateViewportLayout(width, height);
    assert.equal(layout.tableauX.length, 8);
    assert.ok(layout.cardWidth > 0);
    assert.ok(layout.cardHeight > 0);

    const safeViewport: Rect = {
      x: layout.safeArea.left,
      y: layout.safeArea.top,
      width: layout.viewportWidth - layout.safeArea.left - layout.safeArea.right,
      height: layout.viewportHeight - layout.safeArea.top - layout.safeArea.bottom,
    };
    const topRects = [
      ...layout.freeCells.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
      cardRect(layout.flowerFoundation.x, layout.flowerFoundation.y, layout.cardWidth, layout.cardHeight),
      ...layout.foundations.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
      ...layout.dragonControls,
      layout.newDealControl,
      layout.undoControl,
    ];
    for (const rect of topRects) assertInside(rect, safeViewport);

    const tableauRects = layout.tableauX.map((x) => cardRect(x, layout.tableauY, layout.cardWidth, layout.cardHeight));
    for (let i = 1; i < tableauRects.length; i += 1) {
      assert.equal(intersects(tableauRects[i - 1], tableauRects[i]), false, `${width}x${height}: tableau overlap`);
    }

    const fifthBottom = tableauCardY(layout, 5, 4) + layout.cardHeight;
    const boardBottom = layout.boardBounds.y + layout.boardBounds.height - layout.bottomMargin;
    assert.ok(fifthBottom <= boardBottom + 1e-6, `${width}x${height}: fifth card clipped`);
  }
});

test('five-card tableau uses the available vertical space instead of a cramped fixed fan', () => {
  const compact = calculateViewportLayout(844, 390);
  const standard = calculateViewportLayout(1280, 720);
  assert.ok(compact.tableauCardGap >= 22, `compact gap too tight: ${compact.tableauCardGap}`);
  assert.ok(standard.tableauCardGap >= 40, `standard gap too tight: ${standard.tableauCardGap}`);
});

test('F/deal slot is more isolated from R/G/B than numeric foundations are from each other', () => {
  for (const [width, height] of [[844, 390], [1280, 720]] as const) {
    const layout = calculateViewportLayout(width, height);
    const first = layout.foundations[0];
    const second = layout.foundations[1];
    assert.ok(first && second);
    const flowerGap = first.x - (layout.flowerFoundation.x + layout.cardWidth);
    const foundationGap = second.x - (first.x + layout.cardWidth);
    assert.ok(flowerGap > foundationGap, `${width}x${height}: F gap ${flowerGap} <= numeric gap ${foundationGap}`);
  }
});

test('compact service rail uses at least 44 CSS px controls without changing board card geometry', () => {
  const compact = calculateViewportLayout(844, 390);
  assert.ok(compact.newDealControl.height >= 44);
  assert.ok(compact.undoControl.height >= 44);
  const baseline = calculateViewportLayout(844, 390);
  assert.equal(compact.cardWidth, baseline.cardWidth);
  assert.equal(compact.tableauY, baseline.tableauY);
});

test('dragon controls stay in one vertical column between free cells and foundations as cards responsively scale', () => {
  const presets = [[667, 375], [844, 390], [1440, 900], [1920, 1080]] as const;
  for (const [width, height] of presets) {
    const layout = calculateViewportLayout(width, height);
    const [first, second, third] = layout.dragonControls;
    assert.equal(first.x, second.x);
    assert.equal(second.x, third.x);
    assert.ok(first.y + first.height < second.y);
    assert.ok(second.y + second.height < third.y);
    for (const control of layout.dragonControls) {
      assertInside(control, layout.boardBounds);
      assert.ok(control.x >= layout.freeCells[2].x + layout.cardWidth);
      assert.ok(control.x + control.width <= layout.flowerFoundation.x);
      assert.ok(control.y + control.height < layout.tableauY);
    }
  }
});

test('desktop card scale grows with available gameplay area instead of stopping at the old fixed preference', () => {
  const fullHd = calculateViewportLayout(1920, 1080);
  const laptop = calculateViewportLayout(1366, 768);
  const short = calculateViewportLayout(1280, 640);
  assert.ok(fullHd.cardWidth >= 160, `1920x1080 should use the table area: ${fullHd.cardWidth}`);
  assert.ok(laptop.cardWidth >= 124, `1366x768 cards are too small: ${laptop.cardWidth}`);
  assert.ok(short.cardWidth >= 118, `1280x640 cards regressed: ${short.cardWidth}`);
  assert.ok(fullHd.cardWidth > laptop.cardWidth);
  assert.ok(laptop.cardWidth >= short.cardWidth);
});

test('product-shell stress viewports keep board slots, service rail and long tableau inside the safe viewport', () => {
  const presets = [
    [1920, 1080], [1366, 768], [1280, 640], [844, 390], [915, 412],
  ] as const;
  for (const [width, height] of presets) {
    const layout = calculateViewportLayout(width, height);
    const safeViewport: Rect = {
      x: layout.safeArea.left,
      y: layout.safeArea.top,
      width: width - layout.safeArea.left - layout.safeArea.right,
      height: height - layout.safeArea.top - layout.safeArea.bottom,
    };
    const fixedRects: Rect[] = [
      ...layout.freeCells.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
      cardRect(layout.flowerFoundation.x, layout.flowerFoundation.y, layout.cardWidth, layout.cardHeight),
      ...layout.foundations.map((p) => cardRect(p.x, p.y, layout.cardWidth, layout.cardHeight)),
      ...layout.dragonControls,
      layout.homeControl,
      layout.newDealControl,
      layout.undoControl,
    ];
    for (const rect of fixedRects) assertInside(rect, safeViewport);
    const longBottom = tableauCardY(layout, 14, 13) + layout.cardHeight;
    assert.ok(longBottom <= layout.boardBounds.y + layout.boardBounds.height - layout.bottomMargin + 1e-6, `${width}x${height}: long tableau clips`);
  }
});
