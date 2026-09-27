import Phaser from 'phaser';

const ICON_ROOT = '/assets/ui/icons';

export const UI_ART_KEYS = {
  jade: 'ui.home.background', paper: 'ui.panel.paper', material: 'ui.material',
  grain: 'ui.table.grain', paperGrain: 'ui.paper.grain',
} as const;

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
  mastery: 'ui.icon.mastery',
  laurel: 'ui.icon.laurel',
  streak: 'ui.icon.streak',
  soundOn: 'ui.icon.sound-on',
  soundOff: 'ui.icon.sound-off',
  music: 'ui.icon.music',
  profile: 'ui.icon.profile',
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
  mastery: 'mastery.svg',
  laurel: 'laurel.svg',
  streak: 'streak.svg',
  soundOn: 'sound-on.svg',
  soundOff: 'sound-off.svg',
  music: 'music.svg',
  profile: 'profile.svg',
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
  for (const rank of ['novice', 'player', 'tactician', 'expert', 'master', 'grandmaster']) {
    if (!scene.textures.exists(`ui.rank.${rank}`)) scene.load.svg(`ui.rank.${rank}`, `/assets/ui/art/rank-${rank}.svg`, { width: 384, height: 384 });
  }
  scene.load.svg('ui.art.calendar', '/assets/ui/art/daily-calendar.svg', { width: 384, height: 384 });
  const art = { jade: 'jade-landscape', paper: 'paper-landscape', material: 'material', grain: 'table-grain', paperGrain: 'paper-grain' } as const;
  for (const name of Object.keys(art) as (keyof typeof art)[]) {
    if (!scene.textures.exists(UI_ART_KEYS[name])) scene.load.image(UI_ART_KEYS[name], `/assets/ui/art/${art[name]}.webp`);
  }
  for (const [name, key] of Object.entries(UI_ICON_KEYS) as [keyof typeof UI_ICON_KEYS, string][]) {
    if (scene.textures.exists(key)) continue;
    scene.load.svg(key, `${ICON_ROOT}/${UI_ICON_FILES[name]}`, { width: 64, height: 64 });
  }
}
