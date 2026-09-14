import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
