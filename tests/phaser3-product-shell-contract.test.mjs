import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function tsFiles(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

test('product shell remains on Phaser 3 and does not import Phaser 4 packages', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(pkg.dependencies?.phaser ?? '', /^\^?3\./);
  for (const path of tsFiles('src')) {
    const source = readFileSync(path, 'utf8');
    assert.equal(/from\s+['"](?:@phaserjs\/phaser|phaser4)['"]/.test(source), false, `${path} imports a Phaser 4 package`);
  }
});

test('runtime product UI no longer depends on the transitional ProfileRepository', () => {
  const runtime = readFileSync('src/meta/RuntimeServices.ts', 'utf8');
  const boot = readFileSync('src/ui/scenes/BootScene.ts', 'utf8');
  assert.equal(runtime.includes('ProfileRepository'), false);
  assert.equal(runtime.includes('LocalProfileStore'), false);
  assert.equal(boot.includes('.repository'), false);
});
