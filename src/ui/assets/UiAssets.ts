import Phaser from 'phaser';

const ICON_ROOT = '/assets/ui/icons';

export const UI_ICON_KEYS = {
  home: 'ui.icon.home',
  newDeal: 'ui.icon.new-deal',
  undo: 'ui.icon.undo',
  hint: 'ui.icon.hint',
  settings: 'ui.icon.settings',
  back: 'ui.icon.back',
  close: 'ui.icon.close',
  leaderboard: 'ui.icon.leaderboard',
  howToPlay: 'ui.icon.how-to-play',
  daily: 'ui.icon.daily',
  archive: 'ui.icon.archive',
  history: 'ui.icon.history',
  themes: 'ui.icon.themes',
  coin: 'ui.icon.coin',
  mastery: 'ui.icon.mastery',
  laurel: 'ui.icon.laurel',
  streak: 'ui.icon.streak',
  soundOn: 'ui.icon.sound-on',
  soundOff: 'ui.icon.sound-off',
  music: 'ui.icon.music',
  profile: 'ui.icon.profile',
  reward: 'ui.icon.reward',
  purchase: 'ui.icon.purchase',
  check: 'ui.icon.check',
  lock: 'ui.icon.lock',
  info: 'ui.icon.info',
  more: 'ui.icon.more',
  chevronLeft: 'ui.icon.chevron-left',
  chevronRight: 'ui.icon.chevron-right',
  chevronUp: 'ui.icon.chevron-up',
  chevronDown: 'ui.icon.chevron-down',
} as const;

const UI_ICON_FILES: Readonly<Record<keyof typeof UI_ICON_KEYS, string>> = {
  home: 'home.svg',
  newDeal: 'new-deal.svg',
  undo: 'undo.svg',
  hint: 'hint.svg',
  settings: 'settings.svg',
  back: 'back.svg',
  close: 'close.svg',
  leaderboard: 'leaderboard.svg',
  howToPlay: 'how-to-play.svg',
  daily: 'daily.svg',
  archive: 'archive.svg',
  history: 'history.svg',
  themes: 'themes.svg',
  coin: 'coin.svg',
  mastery: 'mastery.svg',
  laurel: 'laurel.svg',
  streak: 'streak.svg',
  soundOn: 'sound-on.svg',
  soundOff: 'sound-off.svg',
  music: 'music.svg',
  profile: 'profile.svg',
  reward: 'reward.svg',
  purchase: 'purchase.svg',
  check: 'check.svg',
  lock: 'lock.svg',
  info: 'info.svg',
  more: 'more.svg',
  chevronLeft: 'chevron-left.svg',
  chevronRight: 'chevron-right.svg',
  chevronUp: 'chevron-up.svg',
  chevronDown: 'chevron-down.svg',
};

export function preloadUiAssets(scene: Phaser.Scene): void {
  for (const [name, key] of Object.entries(UI_ICON_KEYS) as [keyof typeof UI_ICON_KEYS, string][]) {
    if (scene.textures.exists(key)) continue;
    scene.load.svg(key, `${ICON_ROOT}/${UI_ICON_FILES[name]}`, { width: 64, height: 64 });
  }
}
