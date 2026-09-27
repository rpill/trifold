import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGameHudViewModel } from '../src/ui/game/GameHudViewModel.ts';
import { calculateGameHudLayout } from '../src/ui/game/GameHudLayout.ts';
import { calculateViewportLayout } from '../src/game/view/ViewportLayout.ts';

function intersects(a: {x:number;y:number;width:number;height:number}, b: {x:number;y:number;width:number;height:number}) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('HUD formats difficulty, decisions, active time and assisted state', () => {
  const vm = buildGameHudViewModel({
    difficulty: 'hard', moves: 42, activeMs: 65_400, assisted: true,
    canUndo: true, hintEligible: false,
  });
  assert.equal(vm.difficultyLabel, 'Сложная');
  assert.equal(vm.movesLabel, '42 хода');
  assert.equal(vm.timeLabel, '01:05');
  assert.equal(vm.assisted, true);
  assert.equal(vm.undoEnabled, true);
  assert.equal(vm.hintEnabled, false);
  assert.equal('coins' in vm, false);
});

for (const [width, height] of [[1920,1080],[1366,768],[1280,640],[844,390],[915,412]] as const) {
  test(`HUD lives outside the board and keeps touch controls usable at ${width}x${height}`, () => {
    const board = calculateViewportLayout(width, height);
    const hud = calculateGameHudLayout(board);
    for (const control of [hud.home, hud.newDeal, hud.undo, hud.hint, hud.settings]) {
      assert.equal(intersects(control, board.boardBounds), false);
      if (board.profile === 'compact-landscape') assert.ok(control.height >= 44);
    }
    assert.equal(intersects(hud.metrics, board.boardBounds), false);
  });
}

test('HUD can show Daily mode label instead of Standard difficulty', () => {
  const vm = buildGameHudViewModel({
    modeLabel: 'Daily', moves: 12, activeMs: 10_000, assisted: false,
    canUndo: false, hintEligible: false,
  });
  assert.equal(vm.difficultyLabel, 'Daily');
});


test('HUD renders English difficulty and move copy', () => {
  const vm = buildGameHudViewModel({
    difficulty: 'hard', moves: 42, activeMs: 65_400, assisted: true,
    canUndo: true, hintEligible: true,
  }, 'en');
  assert.equal(vm.difficultyLabel, 'Hard');
  assert.equal(vm.movesLabel, '42 moves');
  assert.equal(vm.homeLabel, 'Home');
  assert.equal(vm.newDealLabel, 'New');
  assert.equal(vm.undoLabel, 'Undo');
  assert.equal(vm.hintLabel, 'Hint');
  assert.equal(vm.assistedLabel, 'Assisted');
});


test('HUD view model uses MetaSave-era StandardDifficulty rather than legacy profile types', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/ui/game/GameHudViewModel.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('meta/profile/ProfileTypes'), false);
  assert.match(source, /meta\/MetaSave/);
});
