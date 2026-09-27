import type { VisualQaFixtureFactory } from './types.ts'; import { baseFixture } from './helpers.ts';
export const settingsFixtures:Readonly<Record<string,VisualQaFixtureFactory>>={
  'settings-ru':()=>baseFixture('settings-ru','SettingsScene'),
  'settings-en':()=>{const f=baseFixture('settings-en','SettingsScene');return{...f,preferences:{...f.preferences,language:'en'}};},
};
