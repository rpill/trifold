import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const boot = readFileSync(new URL('../src/ui/scenes/BootScene.ts', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('BootScene routes first launch to the frozen tutorial and completed profiles to Home', () => {
  for (const required of ['preferences.howToPlaySeen', "mode: 'tutorial'", "start('GameScene'", "start('HomeScene'"]) {
    assert.ok(boot.includes(required), `expected BootScene to include ${required}`);
  }
  assert.equal(boot.includes('.repository'), false);
  assert.ok(main.includes('BootScene'));
  assert.match(main, /scene:\s*\[BootScene,\s*HomeScene/);
});

test('GameScene tutorial mode gates commands through TutorialController and never exposes paid Hint', () => {
  for (const required of [
    "'tutorial'", 'StandardSessionController.startTutorial', 'new TutorialController',
    'canPerform(command)', 'recordTransaction(command, result)', 'recordUndo()',
    'showTutorialHint', 'markHowToPlaySeen()',
  ]) assert.ok(game.includes(required), `expected GameScene tutorial wiring to include ${required}`);
  assert.ok(game.includes('this.tutorialController === null'));
});
