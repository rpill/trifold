import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const path = 'src/ui/scenes/DailyScene.ts';

test('DailyScene is a routed responsive dashboard with no hint or rewarded action', () => {
  assert.equal(existsSync(path), true, 'DailyScene must exist');
  const source = readFileSync(path, 'utf8');
  for (const required of [
    'extends BaseUiScene', 'buildDailyViewModel', 'computeDailyLayout',
    "mode: 'new-daily'", "mode: 'resume-daily'", 'officialResult', 'personalBest',
    'currentStreak', 'archive', 'home',
  ]) assert.ok(source.includes(required), `expected DailyScene to include ${required}`);
  assert.equal(/hint/i.test(source), false, 'DailyScene must not expose hint actions');
  assert.equal(/rewarded/i.test(source), false, 'DailyScene must not expose rewarded actions');
});

test('main registers DailyScene as a real routed scene', () => {
  const source = readFileSync('src/main.ts', 'utf8');
  assert.ok(source.includes("import { DailyScene }"));
  assert.ok(source.includes('DailyScene'));
});


test('DailyScene does not depend on active-scene refresh during create', () => {
  const source = readFileSync(path, 'utf8');
  const createStart = source.indexOf('create(): void {');
  const createEnd = source.indexOf('\n  protected layout', createStart);
  const createBody = source.slice(createStart, createEnd);
  assert.equal(createBody.includes('this.refreshCalendar();'), false);
  assert.equal(createBody.includes('this.isUiSceneActive()'), false);
});

test('DailyScene renders the first calendar generation before active-scene guards can suppress it', () => {
  const source = readFileSync(path, 'utf8');
  const createStart = source.indexOf('create(): void {');
  const createEnd = source.indexOf('\n  protected layout', createStart);
  const createBody = source.slice(createStart, createEnd);
  const renderIndex = createBody.indexOf('this.renderCalendarGrid(false);');
  const bindIndex = createBody.indexOf('this.bindResponsiveLayout();');
  assert.ok(renderIndex >= 0, 'DailyScene must synchronously render an initial calendar generation');
  assert.ok(bindIndex >= 0, 'DailyScene must bind responsive layout');
  assert.ok(renderIndex < bindIndex, 'initial grid must exist before bindResponsiveLayout performs the first layout');
});

test('DailyScene treats calendar cells as disposable generations instead of mutating stale Phaser objects', () => {
  const source = readFileSync(path, 'utf8');
  assert.ok(source.includes('private renderCalendarGrid(requestLayout: boolean): void'));
  const renderStart = source.indexOf('private renderCalendarGrid(requestLayout: boolean): void');
  const renderEnd = source.indexOf('\n  private ', renderStart + 10);
  const renderBody = source.slice(renderStart, renderEnd);
  const destroyIndex = renderBody.indexOf('this.destroyCalendarCells();');
  const createIndex = renderBody.indexOf('this.createCalendarCells(keys, vm);');
  assert.ok(destroyIndex >= 0, 'calendar refresh must destroy the previous generation');
  assert.ok(createIndex >= 0, 'calendar refresh must build a fresh generation');
  assert.ok(destroyIndex < createIndex, 'old generation must be destroyed before the new one is created');
  assert.equal(source.includes('cell.label.setText('), false, 'calendar refresh must never mutate an old Text label');
  assert.equal(source.includes('cell.zone.disableInteractive()'), false, 'calendar refresh must never disable a possibly stale Zone');
});
