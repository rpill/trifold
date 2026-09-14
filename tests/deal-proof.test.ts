import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySeedProof, type DealProofAction } from '../src/game/model/DealProof.ts';

test('proof replay failures include seed and action index for corrupt tableau identity', () => {
  const proof: DealProofAction[] = [
    {
      kind: 'move',
      source: { zone: 'tableau', column: 0, cardId: 'coins-9' },
      target: { zone: 'tableau', column: 1 },
    },
  ];
  assert.throws(() => verifySeedProof(1, proof), /seed=1.*action=0/i);
});

test('proof replay rejects a card that is not in the recorded stable tableau column', () => {
  const proof: DealProofAction[] = [
    {
      kind: 'move',
      source: { zone: 'tableau', column: 0, cardId: 'bamboo-1' },
      target: { zone: 'tableau', column: 1 },
    },
  ];
  assert.throws(() => verifySeedProof(1, proof), /seed=1.*action=0.*column/i);
});

test('proof replay rejects a free-cell source that does not contain the recorded card', () => {
  const proof: DealProofAction[] = [
    {
      kind: 'move',
      source: { zone: 'free-cell', cell: 0, cardId: 'bamboo-1' },
      target: { zone: 'tableau', column: 0 },
    },
  ];
  assert.throws(() => verifySeedProof(1, proof), /seed=1.*action=0.*free-cell/i);
});

test('proof replay rejects unknown physical card ids before production rules execute', () => {
  const proof = [
    {
      kind: 'move',
      source: { zone: 'tableau', column: 0, cardId: 'not-a-real-card' },
      target: { zone: 'tableau', column: 1 },
    },
  ] as DealProofAction[];
  assert.throws(() => verifySeedProof(1, proof), /seed=1.*action=0.*unknown card/i);
});
