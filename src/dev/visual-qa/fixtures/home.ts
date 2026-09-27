import type { VisualQaFixtureFactory } from './types.ts'; import { baseFixture, withMastery } from './helpers.ts';
export const homeFixtures: Readonly<Record<string,VisualQaFixtureFactory>> = {
  'home-fresh':()=>baseFixture('home-fresh','HomeScene'),
  'home-progress':()=>{const f=baseFixture('home-progress','HomeScene');return{...f,meta:withMastery(f.meta,'tactician',12)};},
};
