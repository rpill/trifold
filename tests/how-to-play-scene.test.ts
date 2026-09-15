import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/scenes/HowToPlayScene.ts', import.meta.url), 'utf8');
const localization = readFileSync(new URL('../src/i18n/Localization.ts', import.meta.url), 'utf8');

test('How to Play covers the six approved rules through localization and can replay tutorial without clearing progress', () => {
  for (const key of [
    'how.sequenceBody', 'how.freeCellBody', 'how.flowerBody',
    'how.foundationBody', 'how.dragonsBody', 'how.undoBody',
  ]) {
    assert.ok(source.includes(key), `expected HowToPlayScene to use ${key}`);
  }
  for (const phrase of ['черед', 'ячейк', 'цвет', 'основан', 'дракон', 'Отмен']) {
    assert.match(localization, new RegExp(phrase, 'i'));
  }
  assert.ok(source.includes("tr(language, 'how.replayTutorial')"));
  assert.ok(source.includes("mode: 'tutorial'"));
  assert.equal(source.includes('tutorialCompleted: false'), false);
});
