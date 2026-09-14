import { verifySeedProof } from '../../src/game/model/DealProof.ts';

export async function verifyProofRecord(record) {
  if (record?.status !== 'SOLVED') return { ok: false, reason: `record status is ${String(record?.status)}` };
  try {
    const verification = verifySeedProof(record.seed, record.proof);
    return { ok: true, verification };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
