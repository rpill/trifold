export type UiRoute = 'home' | 'standard' | 'daily' | 'mastery' | 'themes' | 'leaderboards';

export const ROUTE_SCENES: Readonly<Record<UiRoute, string>> = {
  home: 'HomeScene',
  standard: 'GameScene',
  daily: 'DailyScene',
  mastery: 'MasteryScene',
  themes: 'ThemesScene',
  leaderboards: 'LeaderboardsScene',
};
