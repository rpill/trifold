import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

export const BASE_THEME_ID: ThemeId = 'base';

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: 'base', displayName: 'Классика', priceCoins: 0,
    board: { surface: '#183f2f' },
    cardBack: { assetKey: 'theme-base-card-back', url: '/assets/themes/base/card-back.png' },
    slots: { recess: '#173a2d', edge: '#8aa095', highlight: '#d7b84d' },
  },
  {
    id: 'launch_01', displayName: 'Тема 1', priceCoins: 300,
    board: { surface: '#4a3129' },
    cardBack: { assetKey: 'theme-launch-01-card-back', url: '/assets/themes/launch_01/card-back.png' },
    slots: { recess: '#3c2924', edge: '#b08a6f', highlight: '#d6ad61' },
  },
  {
    id: 'launch_02', displayName: 'Тема 2', priceCoins: 300,
    board: { surface: '#263f50' },
    cardBack: { assetKey: 'theme-launch-02-card-back', url: '/assets/themes/launch_02/card-back.png' },
    slots: { recess: '#203644', edge: '#86a7b9', highlight: '#d7c27b' },
  },
  {
    id: 'launch_03', displayName: 'Тема 3', priceCoins: 300,
    board: { surface: '#36503c' },
    cardBack: { assetKey: 'theme-launch-03-card-back', url: '/assets/themes/launch_03/card-back.png' },
    slots: { recess: '#2d4333', edge: '#91a98e', highlight: '#d6bd74' },
  },
  {
    id: 'launch_04', displayName: 'Тема 4', priceCoins: 300,
    board: { surface: '#554636' },
    cardBack: { assetKey: 'theme-launch-04-card-back', url: '/assets/themes/launch_04/card-back.png' },
    slots: { recess: '#473b30', edge: '#b9a389', highlight: '#d7b66b' },
  },
  {
    id: 'launch_05', displayName: 'Тема 5', priceCoins: 300,
    board: { surface: '#252d3d' },
    cardBack: { assetKey: 'theme-launch-05-card-back', url: '/assets/themes/launch_05/card-back.png' },
    slots: { recess: '#202735', edge: '#78879d', highlight: '#cdb86c' },
  },
  {
    id: 'launch_06', displayName: 'Тема 6', priceCoins: 300,
    board: { surface: '#4c3b35' },
    cardBack: { assetKey: 'theme-launch-06-card-back', url: '/assets/themes/launch_06/card-back.png' },
    slots: { recess: '#3f322e', edge: '#9e8379', highlight: '#d1aa61' },
  },
] as const;

const BY_ID = new Map<ThemeId, ThemeDefinition>(THEMES.map((theme) => [theme.id, theme]));

export function getLaunchThemes(): readonly ThemeDefinition[] {
  return THEMES;
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && BY_ID.has(value as ThemeId);
}

export function getTheme(id: ThemeId): ThemeDefinition {
  const theme = BY_ID.get(id);
  if (!theme) throw new Error(`Unknown theme id: ${id}`);
  return theme;
}
