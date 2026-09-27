import { getMasteryRequirements } from '../../meta/mastery/Mastery.ts';
import type { MasteryRank, StandardDifficulty } from '../../meta/MetaSave.ts';
import type { StandardWinSettlementResult } from '../../meta/standard/StandardWinSettlement.ts';
import { formatActiveTime } from '../game/GameHudViewModel.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { difficultyLabel, formatMoveCount, rankLabel, tr } from '../../i18n/Localization.ts';

function changedCounterLine(settlement: StandardWinSettlementResult, language: AppLanguage): string | null {
  const before = settlement.masteryBefore; const after = settlement.masteryAfter;
  if (before.rank !== after.rank) return `${rankLabel(language, before.rank)} → ${rankLabel(language, after.rank)}`;
  const requirements = getMasteryRequirements(before.rank);
  if (!requirements) return tr(language, 'mastery.maxLine');
  const counters = [
    ['mastery.counterWins', 'anyWins', requirements.anyWins],
    ['mastery.counterMedium', 'mediumWins', requirements.mediumWins],
    ['mastery.counterHard', 'hardWins', requirements.hardWins],
    [null, 'onTimeDailyWins', requirements.onTimeDailyWins],
  ] as const;
  for (const [labelKey, key, total] of counters) {
    if (total > 0 && before.stage[key] !== after.stage[key]) {
      const label = labelKey ? tr(language, labelKey) : 'Daily';
      return `${label}: ${before.stage[key]} → ${after.stage[key]} / ${total}`;
    }
  }
  return null;
}

function irrelevantDifficultyLine(rank: MasteryRank, difficulty: StandardDifficulty, language: AppLanguage): string | null {
  if (rank === 'grandmaster') return tr(language, 'mastery.maxLine');
  const order: readonly MasteryRank[] = ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster'];
  const nextRank = rankLabel(language, order[order.indexOf(rank) + 1] ?? 'grandmaster');
  if ((rank === 'player' || rank === 'tactician') && difficulty === 'easy') return tr(language, 'mastery.easyIrrelevant', { rank: nextRank });
  if ((rank === 'expert' || rank === 'master') && difficulty !== 'hard') {
    return tr(language, 'mastery.difficultyIrrelevant', { difficulty: difficultyLabel(language, difficulty), rank: nextRank });
  }
  return null;
}

export interface StandardWinAttemptViewModelInput { readonly difficulty: StandardDifficulty; readonly moves: number; readonly activeMs: number; readonly assisted: boolean }
export interface StandardWinViewModel {
  readonly title: string; readonly difficultyLabel: string; readonly resultLine: string;
  readonly masteryLine: string; readonly assistedLabel: string | null;
}

export function buildStandardWinViewModel(settlement: StandardWinSettlementResult, attempt: StandardWinAttemptViewModelInput, language: AppLanguage = 'ru'): StandardWinViewModel {
  const rank = settlement.rankAdvancedTo;
  let masteryLine = tr(language, 'mastery.unchanged');
  if (attempt.assisted) masteryLine = tr(language, 'mastery.assistedNoCredit');
  else if (rank) masteryLine = `${rankLabel(language, settlement.masteryBefore.rank)} → ${rankLabel(language, rank)}`;
  else masteryLine = changedCounterLine(settlement, language)
      ?? (settlement.masteryWasAlreadyCredited ? tr(language, 'mastery.alreadyCredited') : null)
      ?? irrelevantDifficultyLine(settlement.masteryBefore.rank, attempt.difficulty, language)
      ?? (settlement.recordAccepted ? tr(language, 'mastery.newPersonal') : tr(language, 'mastery.unchanged'));
  return {
    title: rank ? tr(language, 'win.newRank', { rank: rankLabel(language, rank) }) : tr(language, 'win.victory'),
    difficultyLabel: difficultyLabel(language, attempt.difficulty),
    resultLine: `${formatMoveCount(language, attempt.moves)} · ${formatActiveTime(attempt.activeMs)}`,
    masteryLine,
    assistedLabel: attempt.assisted ? tr(language, 'win.assisted') : null,
  };
}
