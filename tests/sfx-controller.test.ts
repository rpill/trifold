import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX_ASSETS, SfxController } from '../src/settings/SfxController.ts';

class FakeSoundManager {
  locked = false;
  readonly existing = new Set<string>();
  readonly plays: Array<{ key: string; volume?: number }> = [];
  exists(key: string): boolean { return this.existing.has(key); }
  play(key: string, config?: { volume?: number }): boolean {
    this.plays.push({ key, volume: config?.volume });
    return true;
  }
}

test('Trifold exposes only the six required Cascade cue families', () => {
  assert.deepEqual(Object.keys(SFX_ASSETS).sort(), ['button','card-place','card-touch','deal','undo','victory'].sort());
});

test('locked or missing audio keys are silently skipped', () => {
  const manager = new FakeSoundManager();
  const sfx = new SfxController(manager);
  manager.locked = true;
  sfx.play('button');
  assert.equal(manager.plays.length, 0);
  manager.locked = false;
  sfx.play('button');
  assert.equal(manager.plays.length, 0);
});

test('card-place cycles variants and forwards Cascade volume', () => {
  const manager = new FakeSoundManager();
  for (const key of SFX_ASSETS['card-place'].keys) manager.existing.add(key);
  const sfx = new SfxController(manager);
  for (let i = 0; i < 5; i += 1) sfx.play('card-place');
  assert.deepEqual(manager.plays.map((p) => p.key), [
    'sfx-card-place-1','sfx-card-place-2','sfx-card-place-3','sfx-card-place-4','sfx-card-place-1',
  ]);
  assert.ok(manager.plays.every((p) => p.volume === 0.04));
});
