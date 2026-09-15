import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

test('MasteryScene is a responsive two-column routed UI scene backed by the profile', () => {
  for (const required of [
    'extends BaseUiScene', 'buildMasteryViewModel', 'getRuntimeServices', 'PaperPanel',
    "this.navigation.home()", "'ui.rank.'", 'requirements', 'nextRewardCoins',
  ]) assert.ok(scene.includes(required), `expected MasteryScene to include ${required}`);
});

test('MasteryScene is registered after Home/Game without changing Home startup', () => {
  assert.ok(main.includes('MasteryScene'));
  const match = /scene:\s*\[([^\]]+)\]/.exec(main);
  assert.ok(match);
  if (!match) throw new Error('scene registration list missing');
  const registered = match[1] ?? '';
  const home = registered.indexOf('HomeScene');
  const game = registered.indexOf('GameScene');
  const mastery = registered.indexOf('MasteryScene');
  assert.ok(home >= 0 && game > home && mastery > game);
});
