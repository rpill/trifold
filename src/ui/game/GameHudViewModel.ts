import type { StandardDifficulty } from '../../meta/profile/ProfileTypes.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { difficultyLabel, formatMoveCount, tr } from '../../i18n/Localization.ts';

export interface GameHudInput {
  readonly difficulty?: StandardDifficulty;
  readonly modeLabel?: string;
  readonly moves: number;
  readonly activeMs: number;
  readonly assisted: boolean;
  readonly canUndo: boolean;
  readonly coins: number;
  readonly hintEligible: boolean;
}

export interface GameHudViewModel {
  readonly difficultyLabel: string;
  readonly movesLabel: string;
  readonly timeLabel: string;
  readonly assisted: boolean;
  readonly undoEnabled: boolean;
  readonly hintEnabled: boolean;
  readonly coins: number;
  readonly homeLabel: string;
  readonly newDealLabel: string;
  readonly undoLabel: string;
  readonly hintLabel: string;
  readonly assistedLabel: string;
}

export function formatActiveTime(activeMs: number): string {
  const secondsTotal = Math.max(0, Math.floor(activeMs / 1000));
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function buildGameHudViewModel(input: GameHudInput, language: AppLanguage = 'ru'): GameHudViewModel {
  return {
    difficultyLabel: input.modeLabel ?? difficultyLabel(language, input.difficulty ?? 'easy'),
    movesLabel: formatMoveCount(language, input.moves),
    timeLabel: formatActiveTime(input.activeMs),
    assisted: input.assisted,
    undoEnabled: input.canUndo,
    hintEnabled: input.hintEligible,
    coins: Math.max(0, Math.floor(input.coins)),
    homeLabel: tr(language, 'common.home'),
    newDealLabel: tr(language, 'common.newShort'),
    undoLabel: tr(language, 'hud.undo'),
    hintLabel: tr(language, 'hud.hint'),
    assistedLabel: tr(language, 'hud.assisted'),
  };
}
