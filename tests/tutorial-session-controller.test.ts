import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeal } from '../src/game/model/deal.ts';
import { TrifoldGame } from '../src/game/model/TrifoldGame.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import { StandardSessionController } from '../src/meta/standard/StandardSessionController.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../src/persistence/ActiveGameRepository.ts';
import type { PlayerStorage } from '../src/platform/services.ts';
import { TUTORIAL_SCENARIO } from '../src/tutorial/TutorialScenario.ts';

class MemoryPlayerStorage implements PlayerStorage {
  root: Record<string,unknown> = { trifoldMeta:createDefaultMetaSave() };
  async load():Promise<unknown>{return structuredClone(this.root);}
  async save(data:Record<string,unknown>):Promise<void>{this.root={...this.root,...structuredClone(data)};}
}
class MemoryKv implements ActiveGameStorageLike, MetaJournalStorage {
  map=new Map<string,string>();
  getItem(key:string){return this.map.get(key)??null;}
  setItem(key:string,value:string){this.map.set(key,value);}
  removeItem(key:string){this.map.delete(key);}
}
async function runtimeState(){
  const metaSession=new MetaSession(new MemoryPlayerStorage(),new MetaJournal('tutorial-test',new MemoryKv()));
  assert.equal(await metaSession.load(),true);
  return {metaSession,activeGames:new ActiveGameRepository(new MemoryKv())};
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
  const product=await runtimeState();
  const session = StandardSessionController.startTutorial({
    ...product,
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
  assert.equal(product.activeGames.load(), null);
});

test('tutorial session persistence is transient and preserves an existing Standard save', async () => {
  const product=await runtimeState();
  const seed=123;
  const game=new TrifoldGame(createDeal(seed));
  product.activeGames.save({
    version:1,mode:'standard',seed,game:game.exportSave(),moves:7,activeMs:2500,assisted:false,updatedAtMs:10,
    standard:{partition:'easy',difficulty:'easy'},
  });
  const preserved=product.activeGames.load();
  assert.ok(preserved);

  const tutorial = StandardSessionController.startTutorial({
    ...product,
    timerNow: () => 500,
    wallNow: () => 600,
  });
  const command = TUTORIAL_SCENARIO.guidedCommands[0]!;
  assert.ok(tutorial.perform(command));
  await tutorial.flushPersistence();

  assert.deepEqual(product.activeGames.load(), preserved);
  assert.equal(tutorial.viewState.moves, 1);
  assert.equal(tutorial.viewState.assisted, false);
});
