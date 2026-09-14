import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifySeedProof, type DealProofAction } from '../src/game/model/DealProof.ts';

interface FixtureRecord {
  readonly status: 'SOLVED';
  readonly seed: number;
  readonly nodes: number;
  readonly proof: readonly DealProofAction[];
}

const records = JSON.parse(
  readFileSync(new URL('./fixtures/deals/verified-proof-sample.json', import.meta.url), 'utf8'),
) as FixtureRecord[];

test('committed native solver samples replay through production rules', () => {
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.equal(record.status, 'SOLVED');
    assert.ok(record.proof.length > 0, `seed ${record.seed} proof must be non-empty`);
    const verification = verifySeedProof(record.seed, record.proof);
    assert.equal(verification.seed, record.seed);
    assert.equal(verification.actionCount, record.proof.length);
  }
});
