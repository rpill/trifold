import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultMetaSave } from '../src/meta/MetaSave.ts';
import { productBridge, createTrifoldProductHandlers } from '../src/ui/bridge/TrifoldProductBridge.ts';

function dependencies() {
  let state=createDefaultMetaSave(); let active:any=null; const launches:string[]=[]; let sound=true; let language:'ru'|'en'='ru'; let authorizations=0; let authSyncs=0;
  const handlers=createTrifoldProductHandlers({
    getState:()=>state,
    replaceState:async(next)=>{state=next;return true;},
    getActiveGame:()=>active,
    leaderboards:{available:true,authorized:true,load:async()=>({status:'ready',authorized:true,entries:[],playerEntry:null})},
    authorizeProductAccount:async()=>{authorizations+=1;return true;},
    syncLeaderboardsAfterAuthorization:async()=>{authSyncs+=1;},
    settings:{snapshot:()=>({soundEnabled:sound,language}),setSoundEnabled:(v)=>{sound=v;},setLanguage:(v)=>{language=v;}},
    resumeGame:()=>launches.push('resume'),
    launchStandard:(difficulty)=>launches.push(`standard:${difficulty}`),
    launchDaily:(id)=>launches.push(`daily:${id??'today'}`),
    closeHowToPlay:()=>launches.push('howto'),
  });
  return {handlers,get state(){return state;},setActive(v:any){active=v;},launches,get authorizations(){return authorizations;},get authSyncs(){return authSyncs;}};
}

test('bridge snapshots product meta and active mode without exposing Phaser types',async()=>{
  const d=dependencies();d.setActive({mode:'standard',standard:{difficulty:'hard'}});productBridge.install(d.handlers);
  const snap=productBridge.snapshot();assert.equal(snap.state.standard.selectedDifficulty,'easy');assert.equal(snap.activeMode,'standard');assert.equal(snap.activeDifficulty,'hard');assert.equal(snap.leaderboardsEnabled,true);
  productBridge.uninstall(d.handlers);
});

test('bridge routes fresh Standard, resume and Daily launches without owning ad policy',async()=>{
  const d=dependencies();productBridge.install(d.handlers);
  await productBridge.startStandard('medium');
  productBridge.resumeGame();
  productBridge.startDaily('2026-09-14');
  assert.deepEqual(d.launches,['standard:medium','resume','daily:2026-09-14']);
  productBridge.uninstall(d.handlers);
});

test('difficulty and settings mutations flow through handlers and subscribers are notified',async()=>{
  const d=dependencies();let notifications=0;const unsub=productBridge.subscribe(()=>{notifications+=1;});productBridge.install(d.handlers);
  await productBridge.setStandardDifficulty('hard');productBridge.setSoundEnabled(false);productBridge.setLanguage('en');
  assert.equal(d.state.standard.selectedDifficulty,'hard');assert.deepEqual(productBridge.settingsSnapshot(),{soundEnabled:false,language:'en'});assert.ok(notifications>=3);
  unsub();productBridge.uninstall(d.handlers);
});


test('leaderboard authorization crosses the product-account rebind boundary',async()=>{
  const d=dependencies();productBridge.install(d.handlers);
  assert.equal(await productBridge.authorizeLeaderboard(),true);
  assert.equal(d.authorizations,1);
  assert.equal(d.authSyncs,1);
  productBridge.uninstall(d.handlers);
});
