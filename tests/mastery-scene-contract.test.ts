import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('MasteryScene renders the product MetaSave snapshot rather than legacy profile', () => {
  for (const required of ['extends BaseUiScene','buildMasteryViewModel','productBridge.snapshot()','PaperPanel',"this.navigation.home()","'ui.rank.'",'requirements']) {
    assert.ok(scene.includes(required), `expected MasteryScene to include ${required}`);
  }
  assert.equal(scene.includes('runtime.repository'), false);
});

test('MasteryScene remains registered after Home/Game', () => {
  const match = /scene:\s*\[([^\]]+)\]/.exec(main); assert.ok(match);
  const registered = match?.[1] ?? '';
  assert.ok(registered.indexOf('HomeScene') >= 0 && registered.indexOf('GameScene') > registered.indexOf('HomeScene') && registered.indexOf('MasteryScene') > registered.indexOf('GameScene'));
});
