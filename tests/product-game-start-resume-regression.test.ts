import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('GameScene uses MetaSession/ActiveGameRepository sessions and no legacy ProfileRepository start paths',()=>{
  const source=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
  assert.equal(source.includes('services.repository.current.activeStandard'),false);
  assert.equal(source.includes('repository: services.repository'),false);
  assert.ok(source.includes('metaSession: services.metaSession'));
  assert.ok(source.includes('activeGames: services.activeGames'));
});

test('GameScene owns exactly one fresh Standard ad hook and bridge remains ad-free',()=>{
  const gameSource=readFileSync(new URL('../src/game/scenes/GameScene.ts',import.meta.url),'utf8');
  const bridgeSource=readFileSync(new URL('../src/ui/bridge/TrifoldProductBridge.ts',import.meta.url),'utf8');
  const gameHooks=(gameSource.match(/beforeFreshStandardDeal/g)??[]).length;
  assert.equal(gameHooks,1);
  assert.equal(bridgeSource.includes('beforeFreshStandardDeal'),false);
});

test('main installs the product bridge against RuntimeServices after Phaser starts',()=>{
  const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.ok(source.includes('createTrifoldProductHandlers'));
  assert.ok(source.includes('productBridge.install'));
});
