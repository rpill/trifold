import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisualQaRequest } from '../src/dev/visual-qa/VisualQaMode.ts';

test('visual QA mode is disabled when the build is not DEV even with a query', () => {
  assert.equal(parseVisualQaRequest('?visualQa=home-fresh&viewport=844x390-touch', false), null);
});

test('visual QA mode requires an explicit visualQa query in DEV', () => {
  assert.equal(parseVisualQaRequest('', true), null);
  assert.equal(parseVisualQaRequest('?viewport=844x390-touch', true), null);
});

test('visual QA mode parses explicit scenario and viewport in DEV', () => {
  assert.deepEqual(
    parseVisualQaRequest('?visualQa=home-fresh&viewport=844x390-touch', true),
    { scenarioId: 'home-fresh', viewportId: '844x390-touch' },
  );
});

test('visual QA mode leaves viewport optional so catalog defaults can apply', () => {
  assert.deepEqual(parseVisualQaRequest('?visualQa=game-win', true), {
    scenarioId: 'game-win',
    viewportId: null,
  });
});

test('visual QA launch state is explicit and ready marker is observable', async () => {
  const mode = await import('../src/dev/visual-qa/VisualQaMode.ts');
  mode.clearVisualQaLaunch();
  assert.equal(mode.getVisualQaLaunch(), null);
  mode.installVisualQaLaunch({ scenarioId:'home-fresh', scene:'HomeScene', sceneData:{}, viewportId:'844x390-touch' });
  assert.equal(mode.getVisualQaLaunch()?.scene, 'HomeScene');
  mode.markVisualQaReady('scene-created');
  assert.equal(globalThis.__TRIFOLD_VISUAL_QA__?.ready, true);
  assert.equal(globalThis.__TRIFOLD_VISUAL_QA__?.marker, 'scene-created');
  mode.clearVisualQaLaunch();
});
