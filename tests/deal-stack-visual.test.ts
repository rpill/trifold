import test from 'node:test';
import assert from 'node:assert/strict';

interface DealStackVisualStateLike {
  readonly cardCount: number;
  readonly layerCount: number;
  getLayerOffsets(profile: 'standard' | 'compact-landscape'): readonly number[];
  removeDealtCard(): void;
  sync(cardCount: number): void;
}

type DealStackVisualStateConstructor = new (cardCount: number) => DealStackVisualStateLike;

test('deal stack uses Cascade density and loses visible thickness while 40 cards are dealt', async () => {
  const loaded = await import('../src/game/view/DealStackVisualState.ts').catch(() => ({}));
  const DealStackVisualState = (
    loaded as { DealStackVisualState?: DealStackVisualStateConstructor }
  ).DealStackVisualState;

  assert.equal(typeof DealStackVisualState, 'function', 'Trifold must model the visible deal stack like Cascade');
  if (DealStackVisualState === undefined) assert.fail('DealStackVisualState is unavailable');

  const visual = new DealStackVisualState(40);
  assert.equal(visual.cardCount, 40);
  assert.equal(visual.layerCount, 8);
  assert.deepEqual(visual.getLayerOffsets('standard'), [0, -3, -6, -9, -12, -15, -18, -21]);
  assert.deepEqual(visual.getLayerOffsets('compact-landscape'), [0, -1, -2, -3, -4, -5, -6, -7]);

  for (let index = 0; index < 5; index += 1) visual.removeDealtCard();
  assert.equal(visual.cardCount, 35);
  assert.equal(visual.layerCount, 7, 'one visible layer disappears after five dealt cards');

  for (let index = 0; index < 35; index += 1) visual.removeDealtCard();
  assert.equal(visual.layerCount, 0);
  assert.deepEqual(visual.getLayerOffsets('standard'), []);
});
