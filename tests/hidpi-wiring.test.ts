import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('main uses manual HiDPI backing-store resize wiring', () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  for (const required of [
    'Phaser.Scale.NONE',
    'planHiDpiCanvas',
    'devicePixelRatio',
    'scale.setZoom',
    'scale.resize',
    'ResizeObserver',
    "window.addEventListener('resize'",
    'antialias: true',
    'pixelArt: false',
    'roundPixels: false',
  ]) {
    assert.ok(source.includes(required), `expected main.ts to include ${required}`);
  }
  assert.equal(source.includes('Phaser.Scale.RESIZE'), false);
});
