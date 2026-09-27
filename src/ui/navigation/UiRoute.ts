export type UiRoute = 'home' | 'standard' | 'daily' | 'mastery' | 'leaderboards';

export const ROUTE_SCENES: Readonly<Record<UiRoute, string>> = {
  home: 'HomeScene',
  standard: 'GameScene',
  daily: 'DailyScene',
  mastery: 'MasteryScene',
  leaderboards: 'LeaderboardsScene',
};
