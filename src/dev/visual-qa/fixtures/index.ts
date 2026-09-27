import { homeFixtures } from './home.ts'; import { gameFixtures } from './game.ts'; import { dailyFixtures } from './daily.ts'; import { masteryFixtures } from './mastery.ts'; import { leaderboardFixtures } from './leaderboard.ts'; import { settingsFixtures } from './settings.ts'; import { buildRuntime, type VisualQaRuntime } from './helpers.ts'; import type { VisualQaFixture, VisualQaFixtureFactory } from './types.ts';
const factories:Readonly<Record<string,VisualQaFixtureFactory>>=Object.freeze({...homeFixtures,...gameFixtures,...dailyFixtures,...masteryFixtures,...leaderboardFixtures,...settingsFixtures});
export const VISUAL_QA_FIXTURE_IDS:ReadonlySet<string>=new Set(Object.keys(factories));
export function createVisualQaFixture(id:string):VisualQaFixture{const factory=factories[id];if(!factory)throw new RangeError(`Unknown Visual QA fixture: ${id}`);return structuredClone(factory());}
export function createVisualQaRuntime(fixture:VisualQaFixture):Promise<VisualQaRuntime>{return buildRuntime(structuredClone(fixture));}
export type { VisualQaFixture, VisualQaRuntime };
