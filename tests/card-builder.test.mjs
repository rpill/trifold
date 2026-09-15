import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);

function readPngSize(path) {
  const data = readFileSync(new URL(path, root));
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test('card builder deterministically composes every generated face at the exact frame size', () => {
  const outputs = [
    'public/assets/cards/generated/dragon-red.png',
    'public/assets/cards/generated/dragon-green.png',
    'public/assets/cards/generated/dragon-blue.png',
    'public/assets/cards/generated/flower.png',
    ...['coins', 'bamboo', 'characters'].flatMap((suit) =>
      Array.from({ length: 9 }, (_, index) => `public/assets/cards/generated/${suit}-${index + 1}.png`),
    ),
  ];

  for (const file of outputs) {
    const url = new URL(file, root);
    if (existsSync(url)) rmSync(url);
  }

  const result = spawnSync(process.execPath, ['tools/cards/build-cards.mjs'], {
    cwd: new URL('.', root),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `builder failed:\n${result.stdout}\n${result.stderr}`);

  const frame = readPngSize('assets-src/cards/frame/face.png');
  assert.deepEqual(frame, { width: 868, height: 1353 });

  for (const path of outputs) {
    assert.ok(existsSync(new URL(path, root)), `${path} should be generated`);
    assert.deepEqual(readPngSize(path), frame, `${path} must match frame dimensions exactly`);

    const filename = path.split('/').at(-1);
    assert.ok(filename);
    const oneX = `public/assets/cards/generated/1x/${filename}`;
    const twoX = `public/assets/cards/generated/2x/${filename}`;
    assert.ok(existsSync(new URL(oneX, root)), `${oneX} should be generated`);
    assert.ok(existsSync(new URL(twoX, root)), `${twoX} should be generated`);
    assert.deepEqual(readPngSize(oneX), { width: 128, height: 200 }, `${oneX} must be screen-sized`);
    assert.deepEqual(readPngSize(twoX), { width: 256, height: 399 }, `${twoX} must be HiDPI-sized`);
  }
});
