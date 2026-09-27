import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import type { MasteryRank, MasteryStageProgress, MetaSave } from '../../meta/MetaSave.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { rankLabel, requirementLabel } from '../../i18n/Localization.ts';

export const MASTERY_RANK_ORDER = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'] as const satisfies readonly MasteryRank[];

export interface MasteryRequirementViewModel {
  readonly key: keyof MasteryStageProgress;
  readonly label: string;
  readonly current: number;
  readonly total: number;
}
export interface MasteryPathItemViewModel { readonly rank: MasteryRank; readonly label: string; readonly current: boolean; readonly completed: boolean }
export interface MasteryViewModel {
  readonly rank: MasteryRank; readonly rankLabel: string; readonly requirements: readonly MasteryRequirementViewModel[];
  readonly path: readonly MasteryPathItemViewModel[];
}

export function buildMasteryViewModel(state: MetaSave, language: AppLanguage = 'ru'): MasteryViewModel {
  const { rank, stage } = state.mastery;
  const currentIndex = MASTERY_RANK_ORDER.indexOf(rank);
  const requirements = getMasteryRequirements(rank);
  const keys: readonly (keyof MasteryStageProgress)[] = ['anyWins', 'mediumWins', 'hardWins', 'onTimeDailyWins'];
  const requirementEntries = requirements
    ? keys.filter((key) => requirements[key] > 0).map((key): MasteryRequirementViewModel => ({
      key, label: requirementLabel(language, key), current: stage[key], total: requirements[key],
    }))
    : [];
  return {
    rank,
    rankLabel: rankLabel(language, rank),
    requirements: requirementEntries,
    path: MASTERY_RANK_ORDER.map((pathRank, index) => ({
      rank: pathRank, label: rankLabel(language, pathRank), current: pathRank === rank, completed: index < currentIndex,
    })),
  };
}
