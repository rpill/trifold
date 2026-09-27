import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const path = 'src/ui/scenes/DailyScene.ts';
const source = readFileSync(path, 'utf8');

test('DailyScene is a routed responsive dashboard with no hint or rewarded action', () => {
  assert.equal(existsSync(path), true);
  for (const required of ['extends BaseUiScene','buildDailyViewModel','computeDailyLayout','officialResult','personalBest','currentStreak','archive','home']) {
    assert.ok(source.includes(required), `expected DailyScene to include ${required}`);
  }
  assert.equal(/hint/i.test(source), false);
  assert.equal(/rewarded/i.test(source), false);
});

test('DailyScene consumes product snapshot and launches/resumes Daily through bridge only', () => {
  for (const required of ['productBridge.snapshot()', 'productBridge.startDaily', 'productBridge.resumeGame()']) {
    assert.ok(source.includes(required), `expected DailyScene to include ${required}`);
  }
  assert.equal(source.includes('services.repository'), false);
  assert.equal(source.includes("mode: 'new-daily'"), false);
  assert.equal(source.includes("mode: 'resume-daily'"), false);
});

test('DailyScene renders the first calendar generation before responsive binding', () => {
  const createStart = source.indexOf('create(): void {');
  const createEnd = source.indexOf('\n  protected layout', createStart);
  const createBody = source.slice(createStart, createEnd);
  assert.ok(createBody.indexOf('this.renderCalendarGrid(false);') >= 0);
  assert.ok(createBody.indexOf('this.renderCalendarGrid(false);') < createBody.indexOf('this.bindResponsiveLayout();'));
});

test('DailyScene treats calendar cells as disposable generations', () => {
  const renderStart = source.indexOf('private renderCalendarGrid(requestLayout: boolean): void');
  const renderEnd = source.indexOf('\n  private ', renderStart + 10);
  const renderBody = source.slice(renderStart, renderEnd);
  assert.ok(renderBody.indexOf('this.destroyCalendarCells();') < renderBody.indexOf('this.createCalendarCells(keys, vm);'));
  assert.equal(source.includes('cell.label.setText('), false);
});
