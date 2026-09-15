import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyLayout, computeCalendarCellBounds } from '../src/ui/daily/DailyCalendarLayout.ts';
import { resolveUiViewport, scaleUiViewportForBacking } from '../src/ui/layout/UiViewport.ts';

for (const env of [
  { width: 1920, height: 1080, touchPrimary: false },
  { width: 1280, height: 720, touchPrimary: true },
  { width: 844, height: 390, touchPrimary: true },
]) {
  test(`Daily columns and seven-column grid stay valid at ${env.width}x${env.height}`, () => {
    const viewport = scaleUiViewportForBacking(resolveUiViewport(env), 1);
    const layout = computeDailyLayout(viewport);
    assert.ok(layout.summary.x + layout.summary.width <= layout.calendar.x);
    assert.ok(layout.summary.x >= 0 && layout.calendar.x + layout.calendar.width <= viewport.width);
    const cells = computeCalendarCellBounds(layout.calendarGrid, 42);
    assert.equal(cells.length, 42);
    assert.equal(new Set(cells.slice(0, 7).map((cell) => cell.x)).size, 7);
    assert.ok(cells.every((cell) => cell.x >= layout.calendarGrid.x && cell.x + cell.width <= layout.calendarGrid.x + layout.calendarGrid.width + 0.01));
  });
}
