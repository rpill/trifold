import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import { canDropInFreeCell, canDropOnTableau, canMoveToFoundation } from '../src/game/model/TrifoldRules.ts';
import type { CardSource, PlayerCommand, ReadonlyTrifoldState, TrifoldSnapshot } from '../src/game/model/types.ts';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { MetaJournal, type MetaJournalStorage } from '../src/meta/MetaJournal.ts';
import { MetaSession } from '../src/meta/MetaSession.ts';
import { StandardSessionController } from '../src/meta/standard/StandardSessionController.ts';
import { ActiveGameRepository, type ActiveGameStorageLike } from '../src/persistence/ActiveGameRepository.ts';
import type { PlayerStorage } from '../src/platform/services.ts';

class MemoryPlayerStorage implements PlayerStorage {
  root: Record<string,unknown> = { trifoldMeta:createDefaultMetaSave() };
  async load():Promise<unknown>{return structuredClone(this.root);}
  async save(data:Record<string,unknown>):Promise<void>{this.root={...this.root,...structuredClone(data)};}
}
class MemoryKv implements ActiveGameStorageLike, MetaJournalStorage {
  map=new Map<string,string>(); getItem(k:string){return this.map.get(k)??null;} setItem(k:string,v:string){this.map.set(k,v);} removeItem(k:string){this.map.delete(k);}
}
async function state(){ const player=new MemoryPlayerStorage(); const metaSession=new MetaSession(player,new MetaJournal('std-test',new MemoryKv())); assert.equal(await metaSession.load(),true); return {metaSession,activeGames:new ActiveGameRepository(new MemoryKv())}; }
function catalog():VerifiedDealCatalog{
  const seeds=[11,21,31,41,1,2,3]; const buffer=new ArrayBuffer(seeds.length*4); const view=new DataView(buffer); seeds.forEach((seed,i)=>view.setUint32(i*4,seed,true));
  return VerifiedDealCatalog.decode(buffer,{catalogVersion:2,rulesVersion:1,shuffleVersion:1,seedEncoding:'uint32-le',difficultyModelVersion:1,dailyAlgorithmVersion:1,standardCounts:{onboarding:1,easy:1,medium:1,hard:1},dailyScheduleStart:'2026-09-12',dailyScheduleLength:3,verifiedCount:7,crossPoolDuplicateCount:0,rejectedVerificationCount:0,fastNodeBudget:100,slowNodeBudget:1000,sourceScanRanges:[],solverSourceHash:'solver',gameRulesSourceHash:'rules',productionAssetHash:'hash',offsets:{onboarding:{byteOffset:0,count:1},easy:{byteOffset:4,count:1},medium:{byteOffset:8,count:1},hard:{byteOffset:12,count:1},daily:{byteOffset:16,count:3}}});
}
function sources(s:ReadonlyTrifoldState):CardSource[]{const out:CardSource[]=[];s.tableau.forEach((c,column)=>{for(let index=0;index<c.length;index++)out.push({zone:'tableau',column,index});});return out;}
function firstLegalMove(s:ReadonlyTrifoldState):PlayerCommand{for(const source of sources(s)){for(let column=0;column<s.tableau.length;column++)if(canDropOnTableau(s,source,column))return{type:'move',source,target:{zone:'tableau',column}};for(let cell=0;cell<s.freeCells.length;cell++)if(canDropInFreeCell(s,source,cell))return{type:'move',source,target:{zone:'free-cell',cell}};for(const suit of ['coins','bamboo','characters'] as const)if(canMoveToFoundation(s,source,suit))return{type:'move',source,target:{zone:'foundation',suit}};}throw new Error('Fixture has no legal move.');}
function wonSnapshot(seed:number):TrifoldSnapshot{return{seed,tableau:[[],[],[],[],[],[],[],[]],freeCells:[{kind:'dragons',family:'red',cardIds:['dragon-red-1','dragon-red-2','dragon-red-3','dragon-red-4']},{kind:'dragons',family:'green',cardIds:['dragon-green-1','dragon-green-2','dragon-green-3','dragon-green-4']},{kind:'dragons',family:'white',cardIds:['dragon-white-1','dragon-white-2','dragon-white-3','dragon-white-4']}],foundations:{coins:Array.from({length:9},(_,i)=>`coins-${i+1}`),bamboo:Array.from({length:9},(_,i)=>`bamboo-${i+1}`),characters:Array.from({length:9},(_,i)=>`characters-${i+1}`)},flowerFoundation:'flower'};}

test('new Standard writes active save separately from product meta and records selected difficulty',async()=>{
  const product=await state(); const session=await StandardSessionController.startNew({...product,catalog:catalog(),requestedDifficulty:'easy',randomIndex:()=>0,timerNow:()=>0,wallNow:()=>1});
  assert.equal(product.metaSession.state.standard.selectedDifficulty,'easy');
  assert.equal(product.activeGames.load()?.mode,'standard');
  assert.equal(product.activeGames.load()?.standard?.partition,'onboarding');
  assert.equal('activeStandard' in product.metaSession.state,false);
  assert.equal(session.viewState.seed,11);
});

test('successful command increments exactly one move while invalid and undo do not',async()=>{
  const product=await state(); const session=await StandardSessionController.startNew({...product,catalog:catalog(),requestedDifficulty:'easy',randomIndex:()=>0,timerNow:()=>0,wallNow:()=>0});
  assert.equal(session.perform({type:'move',source:{zone:'tableau',column:0,index:0},target:{zone:'tableau',column:0}}),null);
  assert.equal(session.viewState.moves,0); assert.ok(session.perform(firstLegalMove(session.state))); assert.equal(session.viewState.moves,1); session.undo(); assert.equal(session.viewState.moves,1);
  await session.flushPersistence(); assert.equal(product.activeGames.load()?.moves,1);
});

test('visibility and blocking overlays pause active time and resume without wall gaps',async()=>{
  let now=0; const product=await state(); const session=await StandardSessionController.startNew({...product,catalog:catalog(),requestedDifficulty:'hard',randomIndex:()=>0,timerNow:()=>now,wallNow:()=>now});
  now=500;session.setVisible(false);now=5000;assert.equal(session.viewState.activeMs,500);session.setVisible(true);now=5300;session.setBlockingOverlayOpen(true);now=9000;assert.equal(session.viewState.activeMs,800);session.setBlockingOverlayOpen(false);now=9200;assert.equal(session.viewState.activeMs,1000);
});

test('resume uses persisted active time and never counts offline wall time',async()=>{
  let now=100;const product=await state();const first=await StandardSessionController.startNew({...product,catalog:catalog(),requestedDifficulty:'medium',randomIndex:()=>0,timerNow:()=>now,wallNow:()=>now});now=600;first.setVisible(false);await first.flushPersistence();assert.equal(product.activeGames.load()?.activeMs,500);
  now=100000;const resumed=StandardSessionController.resume({...product,timerNow:()=>now,wallNow:()=>now});assert.equal(resumed.viewState.activeMs,500);now=100250;assert.equal(resumed.viewState.activeMs,750);
});

test('won resume settles once, mutates MetaSave and clears matching active save only after commit',async()=>{
  const product=await state();const seed=21;product.activeGames.save({version:1,mode:'standard',seed,game:{version:1,seed,snapshot:wonSnapshot(seed),history:{version:1,entries:[]}},moves:42,activeMs:1234,assisted:false,updatedAtMs:5000,standard:{partition:'easy',difficulty:'easy'}});
  const session=StandardSessionController.resume({...product,timerNow:()=>9999,wallNow:()=>9999});assert.equal(session.viewState.won,true);const settlement=await session.settleWin();assert.equal(settlement.state.standard.completed.easy.includes(seed),true);assert.equal(product.activeGames.load(),null);assert.deepEqual(await session.settleWin(),settlement);
});

test('tutorial never overwrites a preserved Standard active save',async()=>{
  const product=await state();await StandardSessionController.startNew({...product,catalog:catalog(),requestedDifficulty:'easy',randomIndex:()=>0,timerNow:()=>0,wallNow:()=>0});const before=product.activeGames.load();assert.ok(before);
  const tutorial=StandardSessionController.startTutorial({...product,timerNow:()=>0,wallNow:()=>0});tutorial.setVisible(false);await tutorial.flushPersistence();assert.deepEqual(product.activeGames.load(),before);
});
