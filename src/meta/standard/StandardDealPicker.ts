import type { VerifiedDealCatalog, StandardTier } from '../../game/model/VerifiedDealCatalog.ts';
import type { StandardDifficulty, StandardPartition } from '../profile/ProfileTypes.ts';

export interface StandardDealSelection {
  readonly seed: number;
  readonly partition: StandardPartition;
  readonly difficulty: StandardDifficulty;
  readonly isReplayPoolFallback: boolean;
}

export interface PickStandardSeedInput {
  readonly catalog: Pick<VerifiedDealCatalog, 'getStandardSeeds'>;
  readonly requestedDifficulty: StandardDifficulty;
  readonly onboardingWins: number;
  readonly completedByPartition: Readonly<Record<StandardPartition, readonly number[]>>;
  readonly randomIndex: (size: number) => number;
}

function chooseIndex(size: number, randomIndex: (size: number) => number): number {
  const index = randomIndex(size);
  if (!Number.isSafeInteger(index) || index < 0 || index >= size) {
    throw new RangeError('Standard deal picker returned an invalid index.');
  }
  return index;
}

export function pickStandardSeed(input: PickStandardSeedInput): StandardDealSelection {
  if (!Number.isSafeInteger(input.onboardingWins) || input.onboardingWins < 0) {
    throw new RangeError('onboardingWins must be a non-negative integer.');
  }

  const partition: StandardPartition = input.onboardingWins < 5 && input.requestedDifficulty === 'easy'
    ? 'onboarding'
    : input.requestedDifficulty;
  const difficulty: StandardDifficulty = partition === 'onboarding' ? 'easy' : partition;
  const allSeeds = input.catalog.getStandardSeeds(partition as StandardTier);
  if (allSeeds.length === 0) throw new Error(`Verified Standard partition ${partition} is empty.`);

  const completed = new Set(input.completedByPartition[partition]);
  const unseen = allSeeds.filter((seed) => !completed.has(seed));
  const pool = unseen.length > 0 ? unseen : allSeeds;
  const index = chooseIndex(pool.length, input.randomIndex);

  return {
    seed: pool[index]!,
    partition,
    difficulty,
    isReplayPoolFallback: unseen.length === 0,
  };
}
