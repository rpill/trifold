import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { settleStandardWin } from '../src/meta/standard/StandardWinSettlement.ts';

const baseResult={seed:21,partition:'easy' as const,difficulty:'easy' as const,moves:50,activeMs:60_000,assisted:false};

test('first completion records product progress and replay is idempotent',()=>{
 for(const [difficulty,seed] of [['easy',21],['medium',31],['hard',41]] as const){
  const first=settleStandardWin(createDefaultMetaSave(),{...baseResult,seed,partition:difficulty,difficulty});
  assert.equal(first.firstCompletion,true);
  assert.equal(first.state.standard.completed[difficulty].includes(seed),true);
  const replay=settleStandardWin(first.state,{...baseResult,seed,partition:difficulty,difficulty});
  assert.equal(replay.firstCompletion,false);
  assert.equal(replay.state.standard.completed[difficulty].filter(v=>v===seed).length,1);
 }
});

test('assisted completion records completion but not clean record or Mastery credit',()=>{
 const assisted=settleStandardWin(createDefaultMetaSave(),{...baseResult,assisted:true});
 assert.equal(assisted.recordAccepted,false);
 assert.equal(assisted.masteryAdvanced,false);
 assert.deepEqual(assisted.state.standard.masteryCreditedSeeds,[]);
 const clean=settleStandardWin(assisted.state,{...baseResult,moves:48,activeMs:55_000});
 assert.equal(clean.recordAccepted,true);
 assert.deepEqual(clean.state.standard.personalBests['easy:21'],{moves:48,activeMs:55_000});
 assert.deepEqual(clean.state.standard.masteryCreditedSeeds,[21]);
});

test('personal best uses fewer moves then active time',()=>{
 const first=settleStandardWin(createDefaultMetaSave(),{...baseResult,moves:40,activeMs:70_000});
 const slower=settleStandardWin(first.state,{...baseResult,moves:40,activeMs:80_000});
 assert.equal(slower.recordAccepted,false);
 const faster=settleStandardWin(slower.state,{...baseResult,moves:40,activeMs:60_000});
 assert.equal(faster.recordAccepted,true);
 assert.deepEqual(faster.state.standard.personalBests['easy:21'],{moves:40,activeMs:60_000});
});

test('onboarding completions cap onboardingWins at five',()=>{
 let state=createDefaultMetaSave();
 for(let seed=1;seed<=7;seed+=1){
  state=settleStandardWin(state,{...baseResult,seed,partition:'onboarding',difficulty:'easy'}).state;
 }
 assert.equal(state.standard.onboardingWins,5);
});

test('Mastery snapshots and advancement are returned for UI',()=>{
 const base=createDefaultMetaSave();
 const state={...base,mastery:{rank:'novice' as const,stage:{anyWins:9,mediumWins:0,hardWins:0,onTimeDailyWins:0}}};
 const result=settleStandardWin(state,{...baseResult,seed:77});
 assert.equal(result.rankAdvancedTo,'player');
 assert.deepEqual(result.masteryBefore,state.mastery);
 assert.equal(result.masteryAfter.rank,'player');
});
