import type { AppLanguage } from '../i18n/Language.ts';
import { tr } from '../i18n/Localization.ts';

export type TutorialLesson = 'sequence' | 'free-cell' | 'flower-auto' | 'foundation-auto' | 'dragons' | 'undo' | 'free-play' | 'complete';

export function tutorialText(lesson: TutorialLesson, waitingForUndo = false, language: AppLanguage = 'ru'): string {
  switch (lesson) {
    case 'sequence': return tr(language, 'tutorial.sequence');
    case 'free-cell': return tr(language, 'tutorial.freeCell');
    case 'flower-auto': return tr(language, 'tutorial.flowerAuto');
    case 'foundation-auto': return tr(language, 'tutorial.foundationAuto');
    case 'dragons': return tr(language, 'tutorial.dragons');
    case 'undo': return tr(language, waitingForUndo ? 'tutorial.undoPress' : 'tutorial.undoSetup');
    case 'free-play': return tr(language, 'tutorial.freePlay');
    case 'complete': return tr(language, 'tutorial.complete');
  }
}
