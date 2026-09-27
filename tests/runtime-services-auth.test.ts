import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeServices } from '../src/meta/RuntimeServices.ts';
import { createDefaultMetaSave, type MetaSave } from '../src/meta/MetaSave.ts';
import { VerifiedDealCatalog } from '../src/game/model/VerifiedDealCatalog.ts';
import type { PlatformServices, PlayerStorage } from '../src/platform/services.ts';

function fixtureCatalog(): VerifiedDealCatalog {
  const buffer = new ArrayBuffer(20); const view = new DataView(buffer);
  [11,21,31,41,51].forEach((seed,index)=>view.setUint32(index*4,seed,true));
  return VerifiedDealCatalog.decode(buffer,{catalogVersion:2,rulesVersion:1,shuffleVersion:1,seedEncoding:'uint32-le',difficultyModelVersion:1,dailyAlgorithmVersion:1,standardCounts:{onboarding:1,easy:1,medium:1,hard:1},dailyScheduleStart:'2026-01-01',dailyScheduleLength:1,verifiedCount:5,crossPoolDuplicateCount:0,rejectedVerificationCount:0,fastNodeBudget:100,slowNodeBudget:1000,sourceScanRanges:[],solverSourceHash:'solver',gameRulesSourceHash:'rules',productionAssetHash:'hash',offsets:{onboarding:{byteOffset:0,count:1},easy:{byteOffset:4,count:1},medium:{byteOffset:8,count:1},hard:{byteOffset:12,count:1},daily:{byteOffset:16,count:1}}});
}

class SwitchingPlayerStorage implements PlayerStorage {
  authorized = false;
  readonly byScope = new Map<string, Record<string, unknown>>();
  private currentScope(): string { return this.authorized ? 'yandex-user-1' : 'browser-local'; }
  async scope(){ return this.currentScope(); }
  async load(){ return structuredClone(this.byScope.get(this.currentScope()) ?? {}); }
  async loadStrict(){ return this.load(); }
  async save(data:Record<string,unknown>){ this.byScope.set(this.currentScope(),structuredClone(data)); }
  async saveStrict(data:Record<string,unknown>){ return this.save(data); }
}

function platform(storage:SwitchingPlayerStorage): PlatformServices {
  return {
    playerStorage:storage,
    trustedClock:{nowMs:()=>Date.UTC(2026,8,14)},
    auth:{
      isAuthorized:()=>storage.authorized,
      requestAuthorization:async()=>{storage.authorized=true;return true;},
      onAccountSelectionClosed:()=>()=>undefined,
    },
    leaderboards:{available:true,getEntries:async()=>[],getPlayerEntry:async()=>null,setScore:async()=>undefined},
    ads:{available:false,showInterstitial:async()=>false},
    platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},
    gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined,
  };
}

function withEasy(state:MetaSave, seed:number):MetaSave {
  return {...state,standard:{...state.standard,completed:{...state.standard.completed,easy:[seed]}}};
}

test('runtime authorization rebinds MetaSession to authorized scope and idempotently merges guest progress',async()=>{
  const storage=new SwitchingPlayerStorage();
  storage.byScope.set('browser-local',{trifoldMeta:withEasy(createDefaultMetaSave(),11)});
  storage.byScope.set('yandex-user-1',{trifoldMeta:withEasy(createDefaultMetaSave(),22)});
  const services=await createRuntimeServices({platform:platform(storage),catalogLoader:async()=>fixtureCatalog(),legacyLocalStorage:null,preferenceStorage:null});
  const before=services.metaSession;
  assert.deepEqual(before.state.standard.completed.easy,[11]);
  const authorized=await services.authorizeProductAccount();
  assert.equal(authorized,true);
  assert.notEqual(services.metaSession,before);
  assert.deepEqual(services.metaSession.state.standard.completed.easy,[22,11]);
  const remote=storage.byScope.get('yandex-user-1')?.trifoldMeta as MetaSave;
  assert.deepEqual(remote.standard.completed.easy,[22,11]);
  const second=await services.authorizeProductAccount();
  assert.equal(second,true);
  assert.deepEqual(services.metaSession.state.standard.completed.easy,[22,11]);
});

test('failed authorization keeps the original MetaSession and guest progress',async()=>{
  const storage=new SwitchingPlayerStorage();
  storage.byScope.set('browser-local',{trifoldMeta:withEasy(createDefaultMetaSave(),11)});
  const p=platform(storage);
  p.auth.requestAuthorization=async()=>false;
  const services=await createRuntimeServices({platform:p,catalogLoader:async()=>fixtureCatalog(),legacyLocalStorage:null,preferenceStorage:null});
  const before=services.metaSession;
  assert.equal(await services.authorizeProductAccount(),false);
  assert.equal(services.metaSession,before);
  assert.deepEqual(services.metaSession.state.standard.completed.easy,[11]);
});
