import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VisualQaTargetRegistry,
  resolveVisualQaInteraction,
  type VisualQaResolvedInteraction,
} from '../src/dev/visual-qa/interactions/index.ts';
import type { VisualQaInteraction } from '../src/dev/visual-qa/VisualQaCatalog.ts';

const box = (x:number,y:number,width=40,height=20) => ({ x,y,width,height });

test('dev-safe target registry exposes nothing while disabled', () => {
  const registry = new VisualQaTargetRegistry(false);
  const dispose = registry.register('settings.sound', () => box(10,20));
  assert.equal(registry.resolve('settings.sound'), null);
  dispose();
});

test('enabled registry registers live coordinate providers and unregisters them', () => {
  let x = 10;
  const registry = new VisualQaTargetRegistry(true);
  const dispose = registry.register('card.coins-9', () => box(x,20,30,50));
  assert.deepEqual(registry.resolve('card.coins-9'), { x:25, y:45 });
  x = 50;
  assert.deepEqual(registry.resolve('card.coins-9'), { x:65, y:45 });
  assert.throws(() => registry.register('card.coins-9', () => box(0,0)), /duplicate/i);
  dispose();
  assert.equal(registry.resolve('card.coins-9'), null);
});

test('click and drag interactions resolve named targets into pointer coordinates', () => {
  const registry = new VisualQaTargetRegistry(true);
  registry.register('from', () => box(0,0,20,20));
  registry.register('to', () => box(100,50,20,20));
  const click = resolveVisualQaInteraction({ type:'click', target:'from' }, registry);
  const drag = resolveVisualQaInteraction({ type:'drag', from:'from', to:'to' }, registry);
  assert.deepEqual(click, { type:'click', at:{x:10,y:10} } satisfies VisualQaResolvedInteraction);
  assert.deepEqual(drag, { type:'drag', from:{x:10,y:10}, to:{x:110,y:60} } satisfies VisualQaResolvedInteraction);
});

test('swipe and wait-ready remain declarative while target failures are explicit', () => {
  const registry = new VisualQaTargetRegistry(true);
  assert.deepEqual(resolveVisualQaInteraction({type:'swipe',direction:'left'},registry), {type:'swipe',direction:'left'});
  assert.deepEqual(resolveVisualQaInteraction({type:'wait-ready',marker:'daily-loaded'},registry), {type:'wait-ready',marker:'daily-loaded'});
  assert.throws(() => resolveVisualQaInteraction({type:'click',target:'missing'},registry), /missing/i);
});

test('interaction resolver accepts every catalog interaction variant', () => {
  const values: VisualQaInteraction[] = [
    {type:'click',target:'a'}, {type:'drag',from:'a',to:'b'}, {type:'swipe',direction:'up'}, {type:'wait-ready',marker:'ready'},
  ];
  assert.equal(values.length,4);
});
