import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultProfile } from '../src/meta/profile/ProfileSchema.ts';
import type { PlayerProfileV1 } from '../src/meta/profile/ProfileTypes.ts';
import { ProfileRepository, type ProfileStore } from '../src/meta/profile/ProfileRepository.ts';
import { StandardSessionController } from '../src/meta/standard/StandardSessionController.ts';
import { TUTORIAL_SCENARIO } from '../src/tutorial/TutorialScenario.ts';
import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';

class MemoryStore implements ProfileStore {
  profile: PlayerProfileV1;
  constructor(profile = createDefaultProfile()) { this.profile = structuredClone(profile); }
  async load(): Promise<PlayerProfileV1> { return structuredClone(this.profile); }
  async save(profile: PlayerProfileV1): Promise<void> { this.profile = structuredClone(profile); }
}

function expectedBootstrapSnapshot() {
  const game = new TrifoldGame(createDeal(TUTORIAL_SCENARIO.seed));
  game.settleInitialAutoMoves();
  for (const command of TUTORIAL_SCENARIO.bootstrapCommands) {
    const result = game.perform(command);
    assert.ok(result, 'frozen tutorial bootstrap command must stay legal');
  }
  return game.snapshot();
}

test('tutorial session starts from frozen post-bootstrap state with zero metrics and no undo', async () => {
  const repo = await ProfileRepository.open(new MemoryStore());
  const session = StandardSessionController.startTutorial({
    repository: repo,
    timerNow: () => 100,
    wallNow: () => 200,
  });

  assert.equal(session.viewState.seed, TUTORIAL_SCENARIO.seed);
  assert.equal(session.viewState.partition, 'onboarding');
  assert.equal(session.viewState.difficulty, 'easy');
  assert.equal(session.viewState.moves, 0);
  assert.equal(session.viewState.assisted, false);
  assert.equal(session.canUndo, false);
  assert.deepEqual(session.snapshot(), expectedBootstrapSnapshot());
  assert.equal(repo.current.activeStandard, null);
});

test('tutorial session persistence is transient and preserves an existing Standard save', async () => {
  const baseStore = new MemoryStore();
  const baseRepo = await ProfileRepository.open(baseStore);
  const normal = await StandardSessionController.startNew({
    repository: baseRepo,
    catalog: {
      getStandardSeeds: () => [123],
    },
    requestedDifficulty: 'easy',
    randomIndex: () => 0,
    timerNow: () => 0,
    wallNow: () => 10,
  });
  await normal.flushPersistence();
  const preserved = baseRepo.current.activeStandard;
  assert.ok(preserved);

  const tutorial = StandardSessionController.startTutorial({
    repository: baseRepo,
    timerNow: () => 500,
    wallNow: () => 600,
  });
  const command = TUTORIAL_SCENARIO.guidedCommands[0]!;
  assert.ok(tutorial.perform(command));
  await tutorial.flushPersistence();

  assert.deepEqual(baseRepo.current.activeStandard, preserved);
  assert.equal(tutorial.viewState.moves, 1);
  assert.equal(tutorial.viewState.assisted, false);
});
