import test from 'node:test';
import assert from 'node:assert/strict';
import { StandardAdController } from '../src/ads/StandardAdController.ts';
import type { PlatformServices } from '../src/platform/services.ts';

function platform(options:{available?:boolean;shown?:boolean;throwAd?:boolean;now?:()=>number}={}):PlatformServices{
 let calls=0;
 return {
  playerStorage:{load:async()=>({}),save:async()=>undefined},trustedClock:{nowMs:()=>options.now?.()??0},
  auth:{isAuthorized:()=>false,requestAuthorization:async()=>false,onAccountSelectionClosed:()=>()=>undefined},
  leaderboards:{available:false,getEntries:async()=>[],getPlayerEntry:async()=>null,setScore:async()=>undefined},
  ads:{available:options.available??true,showInterstitial:async()=>{calls+=1;if(options.throwAd)throw new Error('ad');return options.shown??true;}},
  platformPause:{isPaused:()=>false,subscribe:()=>()=>undefined},gameplay:{start:()=>undefined,stop:()=>undefined},ready:()=>undefined,
 };
}

test('shows only every third fresh Standard deal and respects two-minute cooldown', async()=>{
 let now=1_000; const events:string[]=[]; let adCalls=0;
 const p=platform({now:()=>now});
 p.ads.showInterstitial=async()=>{adCalls+=1;return true;};
 const controller=new StandardAdController(p,{track:(event:string)=>events.push(event)} as any);
 await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal();
 assert.equal(adCalls,1);
 await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal();
 assert.equal(adCalls,1,'sixth deal remains in cooldown');
 now += 120_000;
 await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal(); await controller.beforeFreshStandardDeal();
 assert.equal(adCalls,2);
 assert.deepEqual(events,['fullscreen_requested','fullscreen_shown','fullscreen_requested','fullscreen_shown']);
});

test('unavailable and failing ads are non-fatal and failures are tracked', async()=>{
 const unavailableEvents:string[]=[]; const unavailable=new StandardAdController(platform({available:false}),{track:(e:string)=>unavailableEvents.push(e)} as any);
 await unavailable.beforeFreshStandardDeal();await unavailable.beforeFreshStandardDeal();await unavailable.beforeFreshStandardDeal();
 assert.deepEqual(unavailableEvents,[]);
 const events:string[]=[];const failing=new StandardAdController(platform({throwAd:true}),{track:(e:string)=>events.push(e)} as any);
 await failing.beforeFreshStandardDeal();await failing.beforeFreshStandardDeal();await failing.beforeFreshStandardDeal();
 assert.deepEqual(events,['fullscreen_requested','fullscreen_not_shown']);
});
