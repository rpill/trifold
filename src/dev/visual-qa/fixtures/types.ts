import type { MetaSave } from '../../../meta/MetaSave.ts';
import type { TrifoldActiveGameSave } from '../../../persistence/ActiveGameSave.ts';
import type { PlatformLeaderboardEntry } from '../../../platform/services.ts';
import type { Language } from '../../../settings/Preferences.ts';

export interface VisualQaFixture {
  readonly id: string;
  readonly scene: string;
  readonly meta: MetaSave;
  readonly activeGame: TrifoldActiveGameSave | null;
  readonly gamePose?: string;
  readonly preferences: { readonly language: Language; readonly soundEnabled: boolean; readonly howToPlaySeen: boolean };
  readonly platform: {
    readonly nowMs: number;
    readonly authorized: boolean;
    readonly leaderboardAvailable: boolean;
    readonly leaderboardEntries: readonly PlatformLeaderboardEntry[];
    readonly playerLeaderboardEntry: PlatformLeaderboardEntry | null;
  };
  readonly sceneData?: Readonly<Record<string, unknown>>;
}

export type VisualQaFixtureFactory = () => VisualQaFixture;
