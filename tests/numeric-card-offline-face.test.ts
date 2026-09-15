import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('numeric cards are built offline from reusable rank and suit modules', () => {
  const assets = source('src/game/view/CardFaceAssets.ts');
  const card = source('src/game/view/SchematicCardView.ts');
  const builder = source('tools/cards/build-cards.mjs');

  for (let rank = 1; rank <= 9; rank += 1) {
    assert.ok(existsSync(new URL(`assets-src/cards/numbers/ranks/${rank}.png`, root)), `rank ${rank} module missing`);
  }
  for (const suit of ['coins', 'bamboo', 'characters']) {
    assert.ok(existsSync(new URL(`assets-src/cards/numbers/suits/${suit}.png`, root)), `${suit} module missing`);
  }

  assert.ok(builder.includes('NUMBER_CARD_BUILD'));
  assert.ok(builder.includes('assets-src/cards/numbers/ranks/'));
  assert.ok(builder.includes('assets-src/cards/numbers/suits/'));
  assert.ok(assets.includes('numericFaceKey'));
  assert.ok(card.includes("card.kind === 'number'"));
  assert.ok(card.includes('numericFaceKey(card.suit, card.rank)'));
});
