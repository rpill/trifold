import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('dragon and flower cards are built offline into generated textures', () => {
  const pkg = JSON.parse(source('package.json')) as { scripts?: Record<string, string> };
  const assets = source('src/game/view/CardFaceAssets.ts');
  const card = source('src/game/view/SchematicCardView.ts');

  assert.equal(pkg.scripts?.['cards:build'], 'node tools/cards/build-cards.mjs');
  assert.ok(existsSync(new URL('tools/cards/build-cards.mjs', root)));
  assert.ok(existsSync(new URL('assets-src/cards/frame/face.png', root)));

  for (const color of ['red', 'green', 'blue']) {
    assert.ok(existsSync(new URL(`assets-src/cards/dragons/${color}-center.png`, root)));
    assert.ok(existsSync(new URL(`assets-src/cards/dragons/${color}-corner.png`, root)));
    assert.ok(assets.includes(`dragon-${color}.png`), `runtime should load generated ${color} dragon card`);
  }

  assert.ok(existsSync(new URL('assets-src/cards/flower/center.png', root)));
  assert.ok(existsSync(new URL('assets-src/cards/flower/corner.png', root)));
  assert.ok(assets.includes('flower.png'), 'runtime should load generated flower card');

  for (const forbidden of [
    'dragonRedCenter', 'dragonGreenCenter', 'dragonWhiteCenter',
    'dragonRedCorner', 'dragonGreenCorner', 'dragonWhiteCorner',
    'dragonCenterKey', 'dragonCornerKey',
  ]) {
    assert.equal(assets.includes(forbidden), false, `runtime assets must not include build-time module ${forbidden}`);
  }

  for (const forbidden of [
    'faceFrameImage', 'dragonCenterImage', 'dragonCornerTopImage', 'dragonCornerBottomImage',
    'DRAGON_CENTER_HEIGHT_RATIO', 'DRAGON_CORNER_WIDTH_RATIO', 'renderCustomFaceBorder',
  ]) {
    assert.equal(card.includes(forbidden), false, `runtime card renderer must not compose ${forbidden}`);
  }

  assert.ok(card.includes('dragonFaceKey'), 'runtime card renderer should use one generated texture for dragons');
  assert.ok(card.includes('flowerFaceKey'), 'runtime card renderer should use one generated texture for flower');
  assert.ok(card.includes("card.kind === 'flower'"), 'runtime card renderer should use the generated flower face');
  assert.ok(card.includes('faceImage'), 'runtime card renderer should render generated faces as one image');
});

test('legacy white dragon family is rendered with the blue generated card for save/catalog compatibility', () => {
  const assets = source('src/game/view/CardFaceAssets.ts');
  assert.ok(assets.includes('CARD_FACE_KEYS.dragonBlue'));
  assert.ok(assets.includes('dragon-blue.png'));
  assert.equal(assets.includes('dragonWhite'), false);
});
