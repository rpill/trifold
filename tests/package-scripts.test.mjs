import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('package exposes the complete verified-deal factory command surface', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.test, /^node tools\/deals\/build-solver\.mjs && /);
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  for (const key of [
    'deals:build-solver',
    'deals:calibrate',
    'deals:generate',
    'deals:probe',
    'deals:verify-all',
    'deals:report',
  ]) {
    assert.equal(typeof pkg.scripts[key], 'string', `missing script ${key}`);
  }
});

test('package exposes Yandex SDK dev launch command', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['dev:yandex'], 'node tools/dev/yandex-dev.mjs');
});

test('Yandex dev launcher runs Vite behind the official SDK dev proxy', () => {
  const launcher = new URL('../tools/dev/yandex-dev.mjs', import.meta.url);
  assert.equal(existsSync(launcher), true);
  if (!existsSync(launcher)) return;
  const source = readFileSync(launcher, 'utf8');
  assert.match(source, /VITE_YANDEX_DEV/);
  assert.match(source, /@yandex-games\/sdk-dev-proxy@0\.0\.2/);
  assert.match(source, /--dev-mode=true/);
  assert.match(source, /127\.0\.0\.1:5173/);
});
