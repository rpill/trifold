import type { MasteryRank, StandardDifficulty } from '../meta/profile/ProfileTypes.ts';
import type { ThemeId } from '../theme/ThemeDefinition.ts';
import type { AppLanguage } from './Language.ts';

const RU = {
  'common.play': 'Играть',
  'common.continue': 'Продолжить',
  'common.newDeal': 'Новая раздача',
  'common.newShort': 'Новая',
  'common.cancel': 'Отмена',
  'common.start': 'Начать',
  'common.home': 'Домой',
  'common.back': 'Назад',
  'common.replay': 'Переиграть',
  'common.loading': 'Загрузка…',
  'common.coins': '{count} монет',
  'common.bonusAd': '+{count} за рекламу',

  'home.themes': 'Темы',
  'home.subtitle': 'Пасьянс · путь мастерства',
  'home.confirmNewTitle': 'Начать новую раздачу?',
  'home.confirmNewBody': 'Текущая незавершённая партия будет заменена.',
  'home.dailyCompleted': 'Сегодня пройдено · серия {streak}',
  'home.dailyContinue': 'Продолжить · серия {streak}',
  'home.dailyNew': 'Сегодня новая · серия {streak}',
  'home.masteryMax': 'Максимальный ранг',
  'home.masteryWins': 'Победы {current} / {total}',
  'home.masteryMedium': 'Средние {current} / {total}',
  'home.masteryHard': 'Сложные {current} / {total}',
  'home.masteryDaily': 'Daily {current} / {total}',

  'settings.title': 'Настройки',
  'settings.soundOn': 'Звуки: включены',
  'settings.soundOff': 'Звуки: выключены',
  'settings.disableSound': 'Выключить звуки',
  'settings.enableSound': 'Включить звуки',
  'settings.language': 'Язык',
  'settings.russianName': 'Русский',
  'settings.englishName': 'English',

  'hud.undo': 'Отмена',
  'hud.hint': 'Подсказка',
  'hud.assisted': 'С подсказкой',

  'daily.playToday': 'Играть сегодня',
  'daily.playArchive': 'Играть архив',
  'daily.notCompleted': 'Ещё не пройдено',
  'daily.reward': '+{count} монет',
  'daily.streakSummary': 'Серия {current} · рекорд {best}',
  'daily.official': 'Официальный: {result}',
  'daily.personal': 'Личный: {result}',
  'daily.confirmTitle': 'Начать другую Daily?',
  'daily.confirmBody': 'Текущая незавершённая Daily-попытка будет заменена.',
  'daily.winToday': 'Daily завершён',
  'daily.winArchive': 'Архив завершён',
  'daily.officialShort': 'Официально: {result}',
  'daily.personalShort': 'Личный: {result}',
  'daily.streak': 'Серия: {streak}',

  'mastery.nextRank': 'До следующего ранга',
  'mastery.maxRank': 'Высший ранг достигнут',
  'mastery.rankReward': 'Награда за ранг: +{count} монет',
  'mastery.complete': 'Mastery завершён',
  'mastery.maxLine': 'Максимальный ранг Mastery',
  'mastery.unchanged': 'Mastery без изменений',
  'mastery.assistedNoCredit': 'С подсказкой: Mastery и официальный рекорд не засчитаны',
  'mastery.alreadyCredited': 'Эта раздача уже учитывалась в Mastery',
  'mastery.newPersonal': 'Новый личный результат',
  'mastery.easyIrrelevant': 'Лёгкие победы не требуются для ранга {rank}',
  'mastery.difficultyIrrelevant': '{difficulty} победы не требуются для ранга {rank}',
  'mastery.counterWins': 'Победы',
  'mastery.counterMedium': 'Средние',
  'mastery.counterHard': 'Сложные',

  'leaderboards.title': 'Таблицы лидеров',
  'leaderboards.streak': 'Серия',
  'leaderboards.signIn': 'Войти',
  'leaderboards.signInSubtitle': 'Облачный прогресс и личное место',
  'leaderboards.authUnavailable': 'Авторизация доступна через Яндекс Игры',
  'leaderboards.yourRank': 'Ваше место: {rank}',
  'leaderboards.top': 'Лучшие результаты',
  'leaderboards.unavailable': 'Таблица лидеров недоступна',
  'leaderboards.failed': 'Не удалось загрузить результаты',
  'leaderboards.player': 'Игрок',

  'themes.title': 'Темы',
  'themes.buyCoins': 'Купить монеты',
  'themes.purchasesUnavailable': 'Покупки пока недоступны',
  'themes.purchasing': 'Покупка…',
  'themes.active': 'Используется',
  'themes.owned': 'В коллекции',
  'themes.locked': 'Не открыта',
  'themes.apply': 'Применить',

  'how.sequenceTitle': 'Последовательности',
  'how.sequenceBody': 'Карты числовых мастей складываются по убыванию, чередуя масти. Готовую последовательность можно переносить целиком.',
  'how.freeCellTitle': 'Свободные ячейки',
  'how.freeCellBody': 'Три свободные ячейки временно хранят по одной карте. Используйте их, чтобы открыть нужные карты в столбцах.',
  'how.flowerTitle': 'Цветок',
  'how.flowerBody': 'Когда цветок становится доступен, он автоматически уходит в отдельное основание.',
  'how.foundationTitle': 'Основания',
  'how.foundationBody': 'Безопасные младшие числовые карты автоматически уходят в основания своих мастей от 1 к 9.',
  'how.dragonsTitle': 'Драконы',
  'how.dragonsBody': 'Откройте четыре дракона одного цвета и соберите их кнопкой RD, GD или BD. После сборки одна свободная ячейка блокируется.',
  'how.undoTitle': 'Отмена',
  'how.undoBody': 'Кнопка «Отменить» возвращает последний ваш ход вместе со всеми автоматическими перемещениями, которые он вызвал.',
  'how.replayTutorial': 'Пройти обучение ещё раз',

  'tutorial.sequence': 'Соберите убывающую последовательность, чередуя масти.',
  'tutorial.freeCell': 'Свободная ячейка временно хранит одну карту.',
  'tutorial.flowerAuto': 'Освободите путь к цветку — он уйдёт наверх автоматически.',
  'tutorial.foundationAuto': 'Освободите безопасную младшую карту — она уйдёт в основание автоматически.',
  'tutorial.dragons': 'Откройте четыре красных дракона и соберите их кнопкой RD.',
  'tutorial.undoSetup': 'Сделайте показанный ход — затем мы отменим его.',
  'tutorial.undoPress': 'Теперь нажмите «Отменить», чтобы вернуть последний ход.',
  'tutorial.freePlay': 'Отлично. Теперь завершите раздачу самостоятельно.',
  'tutorial.complete': 'Обучение завершено.',

  'win.victory': 'Победа',
  'win.newRank': 'Новый ранг: {rank}',
  'win.assisted': 'Партия с подсказкой',
  'win.rankReward': '+{count} за ранг',
  'win.rewardClaimed': 'Награда уже получена',
  'win.doubleCoins': '×2 монеты',

  'error.openDeal': 'Не удалось открыть раздачу',
  'error.newStandard': 'Не удалось начать новую раздачу',
  'error.newDaily': 'Не удалось начать Daily',
  'error.saveWin': 'Не удалось сохранить победу',
  'error.startup': 'Не удалось загрузить данные игры.',
} as const;

type TranslationKey = keyof typeof RU;

const EN: Record<TranslationKey, string> = {
  'common.play': 'Play',
  'common.continue': 'Continue',
  'common.newDeal': 'New deal',
  'common.newShort': 'New',
  'common.cancel': 'Cancel',
  'common.start': 'Start',
  'common.home': 'Home',
  'common.back': 'Back',
  'common.replay': 'Replay',
  'common.loading': 'Loading…',
  'common.coins': '{count} coins',
  'common.bonusAd': '+{count} from ad',

  'home.themes': 'Themes',
  'home.subtitle': 'Solitaire · path to mastery',
  'home.confirmNewTitle': 'Start a new deal?',
  'home.confirmNewBody': 'The current unfinished game will be replaced.',
  'home.dailyCompleted': 'Completed today · streak {streak}',
  'home.dailyContinue': 'Continue · streak {streak}',
  'home.dailyNew': 'Today · new · streak {streak}',
  'home.masteryMax': 'Maximum rank',
  'home.masteryWins': 'Wins {current} / {total}',
  'home.masteryMedium': 'Medium {current} / {total}',
  'home.masteryHard': 'Hard {current} / {total}',
  'home.masteryDaily': 'Daily {current} / {total}',

  'settings.title': 'Settings',
  'settings.soundOn': 'Sound: on',
  'settings.soundOff': 'Sound: off',
  'settings.disableSound': 'Turn sound off',
  'settings.enableSound': 'Turn sound on',
  'settings.language': 'Language',
  'settings.russianName': 'Русский',
  'settings.englishName': 'English',

  'hud.undo': 'Undo',
  'hud.hint': 'Hint',
  'hud.assisted': 'Assisted',

  'daily.playToday': 'Play today',
  'daily.playArchive': 'Play archive',
  'daily.notCompleted': 'Not completed yet',
  'daily.reward': '+{count} coins',
  'daily.streakSummary': 'Streak {current} · best {best}',
  'daily.official': 'Official: {result}',
  'daily.personal': 'Personal: {result}',
  'daily.confirmTitle': 'Start another Daily?',
  'daily.confirmBody': 'The current unfinished Daily attempt will be replaced.',
  'daily.winToday': 'Daily complete',
  'daily.winArchive': 'Archive complete',
  'daily.officialShort': 'Official: {result}',
  'daily.personalShort': 'Personal: {result}',
  'daily.streak': 'Streak: {streak}',

  'mastery.nextRank': 'Until next rank',
  'mastery.maxRank': 'Highest rank reached',
  'mastery.rankReward': 'Rank reward: +{count} coins',
  'mastery.complete': 'Mastery complete',
  'mastery.maxLine': 'Maximum Mastery rank',
  'mastery.unchanged': 'Mastery unchanged',
  'mastery.assistedNoCredit': 'Assisted: Mastery and official record are not credited',
  'mastery.alreadyCredited': 'This deal has already counted toward Mastery',
  'mastery.newPersonal': 'New personal best',
  'mastery.easyIrrelevant': 'Easy wins are not required for {rank}',
  'mastery.difficultyIrrelevant': '{difficulty} wins are not required for {rank}',
  'mastery.counterWins': 'Wins',
  'mastery.counterMedium': 'Medium',
  'mastery.counterHard': 'Hard',

  'leaderboards.title': 'Leaderboards',
  'leaderboards.streak': 'Streak',
  'leaderboards.signIn': 'Sign in',
  'leaderboards.signInSubtitle': 'Cloud progress and your personal rank',
  'leaderboards.authUnavailable': 'Sign-in is available through Yandex Games',
  'leaderboards.yourRank': 'Your rank: {rank}',
  'leaderboards.top': 'Top results',
  'leaderboards.unavailable': 'Leaderboard unavailable',
  'leaderboards.failed': 'Could not load results',
  'leaderboards.player': 'Player',

  'themes.title': 'Themes',
  'themes.buyCoins': 'Buy coins',
  'themes.purchasesUnavailable': 'Purchases are unavailable',
  'themes.purchasing': 'Purchasing…',
  'themes.active': 'In use',
  'themes.owned': 'In collection',
  'themes.locked': 'Locked',
  'themes.apply': 'Apply',

  'how.sequenceTitle': 'Sequences',
  'how.sequenceBody': 'Number suits stack in descending order while alternating suits. A complete sequence can be moved as one unit.',
  'how.freeCellTitle': 'Free cells',
  'how.freeCellBody': 'Three free cells can temporarily hold one card each. Use them to uncover the cards you need in the columns.',
  'how.flowerTitle': 'Flower',
  'how.flowerBody': 'When the flower becomes available, it moves to its foundation automatically.',
  'how.foundationTitle': 'Foundations',
  'how.foundationBody': 'Safe low number cards automatically move to their suit foundations from 1 through 9.',
  'how.dragonsTitle': 'Dragons',
  'how.dragonsBody': 'Expose four dragons of one color and collect them with RD, GD or BD. One free cell becomes blocked after collection.',
  'how.undoTitle': 'Undo',
  'how.undoBody': 'Undo returns your last move together with every automatic move it triggered.',
  'how.replayTutorial': 'Replay tutorial',

  'tutorial.sequence': 'Build a descending sequence while alternating suits.',
  'tutorial.freeCell': 'A free cell temporarily stores one card.',
  'tutorial.flowerAuto': 'Clear the path to the flower — it will move up automatically.',
  'tutorial.foundationAuto': 'Uncover a safe low card — it will move to its foundation automatically.',
  'tutorial.dragons': 'Expose all four red dragons and collect them with the RD button.',
  'tutorial.undoSetup': 'Make the highlighted move — then we will undo it.',
  'tutorial.undoPress': 'Now press Undo to return the last move.',
  'tutorial.freePlay': 'Great. Now finish the deal on your own.',
  'tutorial.complete': 'Tutorial complete.',

  'win.victory': 'Victory',
  'win.newRank': 'New rank: {rank}',
  'win.assisted': 'Assisted game',
  'win.rankReward': '+{count} rank reward',
  'win.rewardClaimed': 'Reward already claimed',
  'win.doubleCoins': '×2 coins',

  'error.openDeal': 'Could not open the deal',
  'error.newStandard': 'Could not start a new deal',
  'error.newDaily': 'Could not start Daily',
  'error.saveWin': 'Could not save the victory',
  'error.startup': 'Could not load game data.',
};

const DIFFICULTIES: Readonly<Record<AppLanguage, Readonly<Record<StandardDifficulty, string>>>> = {
  ru: { easy: 'Лёгкая', medium: 'Средняя', hard: 'Сложная' },
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
};

const DIFFICULTY_SELECTOR: Readonly<Record<AppLanguage, Readonly<Record<StandardDifficulty, string>>>> = {
  ru: { easy: 'Легко', medium: 'Средне', hard: 'Сложно' },
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
};

const RANKS: Readonly<Record<AppLanguage, Readonly<Record<MasteryRank, string>>>> = {
  ru: {
    novice: 'Новичок', player: 'Игрок', tactician: 'Тактик', expert: 'Эксперт', master: 'Мастер', grandmaster: 'Грандмастер',
  },
  en: {
    novice: 'Novice', player: 'Player', tactician: 'Tactician', expert: 'Expert', master: 'Master', grandmaster: 'Grandmaster',
  },
};

const REQUIREMENTS: Readonly<Record<AppLanguage, Readonly<Record<'anyWins' | 'mediumWins' | 'hardWins' | 'onTimeDailyWins', string>>>> = {
  ru: { anyWins: 'Любые победы', mediumWins: 'Средние', hardWins: 'Сложные', onTimeDailyWins: 'Daily' },
  en: { anyWins: 'Wins', mediumWins: 'Medium wins', hardWins: 'Hard wins', onTimeDailyWins: 'Daily' },
};

const MONTHS: Readonly<Record<AppLanguage, readonly string[]>> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const THEMES: Readonly<Record<AppLanguage, Readonly<Record<ThemeId, string>>>> = {
  ru: { base: 'Классика', launch_01: 'Тема 1', launch_02: 'Тема 2', launch_03: 'Тема 3', launch_04: 'Тема 4', launch_05: 'Тема 5', launch_06: 'Тема 6' },
  en: { base: 'Classic', launch_01: 'Theme 1', launch_02: 'Theme 2', launch_03: 'Theme 3', launch_04: 'Theme 4', launch_05: 'Theme 5', launch_06: 'Theme 6' },
};

export function tr(
  language: AppLanguage,
  key: TranslationKey,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const template = language === 'en' ? EN[key] : RU[key];
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name: string) => String(values[name] ?? `{${name}}`));
}

export function difficultyLabel(language: AppLanguage, difficulty: StandardDifficulty): string {
  return DIFFICULTIES[language][difficulty];
}

export function difficultySelectorLabel(language: AppLanguage, difficulty: StandardDifficulty): string {
  return DIFFICULTY_SELECTOR[language][difficulty];
}

export function rankLabel(language: AppLanguage, rank: MasteryRank): string {
  return RANKS[language][rank];
}

export function requirementLabel(
  language: AppLanguage,
  key: 'anyWins' | 'mediumWins' | 'hardWins' | 'onTimeDailyWins',
): string {
  return REQUIREMENTS[language][key];
}

export function monthName(language: AppLanguage, month: number): string {
  return MONTHS[language][month - 1] ?? '';
}

export function themeDisplayName(language: AppLanguage, id: ThemeId): string {
  return THEMES[language][id];
}

export function formatMoveCount(language: AppLanguage, moves: number): string {
  const value = Math.max(0, Math.floor(moves));
  if (language === 'en') return `${value} ${value === 1 ? 'move' : 'moves'}`;
  const mod100 = value % 100;
  const mod10 = value % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? 'ходов' : mod10 === 1 ? 'ход' : mod10 >= 2 && mod10 <= 4 ? 'хода' : 'ходов';
  return `${value} ${noun}`;
}
