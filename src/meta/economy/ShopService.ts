import { BASE_THEME_ID, getLaunchThemes, getTheme } from '../../theme/ThemeCatalog.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import type { PlayerProfileV1 } from '../profile/ProfileTypes.ts';

export type ThemePurchaseResult =
  | { readonly status: 'purchased'; readonly profile: PlayerProfileV1; readonly price: 300 }
  | { readonly status: 'already-owned' | 'insufficient-coins' | 'free-theme'; readonly profile: PlayerProfileV1 };

export type ThemeApplyResult =
  | { readonly status: 'applied'; readonly profile: PlayerProfileV1 }
  | { readonly status: 'already-active' | 'not-owned'; readonly profile: PlayerProfileV1 };

export interface ShopThemeCard {
  readonly id: ThemeId;
  readonly displayName: string;
  readonly priceCoins: 0 | 300;
  readonly owned: boolean;
  readonly active: boolean;
  readonly action: 'buy' | 'apply' | 'none';
}

function orderedOwned(ids: Iterable<ThemeId>): readonly ThemeId[] {
  const owned = new Set(ids);
  owned.add(BASE_THEME_ID);
  return getLaunchThemes().map((theme) => theme.id).filter((id) => owned.has(id));
}

export function purchaseTheme(profile: PlayerProfileV1, themeId: ThemeId): ThemePurchaseResult {
  const theme = getTheme(themeId);
  if (theme.priceCoins === 0) return { status: 'free-theme', profile };
  if (profile.ownedThemeIds.includes(themeId)) return { status: 'already-owned', profile };
  if (profile.coins < theme.priceCoins) return { status: 'insufficient-coins', profile };
  return {
    status: 'purchased',
    price: 300,
    profile: {
      ...profile,
      coins: profile.coins - theme.priceCoins,
      ownedThemeIds: orderedOwned([...profile.ownedThemeIds, themeId]),
    },
  };
}

export function applyTheme(profile: PlayerProfileV1, themeId: ThemeId): ThemeApplyResult {
  if (!profile.ownedThemeIds.includes(themeId)) return { status: 'not-owned', profile };
  if (profile.activeThemeId === themeId) return { status: 'already-active', profile };
  return { status: 'applied', profile: { ...profile, activeThemeId: themeId } };
}

export function getShopCards(profile: PlayerProfileV1): readonly ShopThemeCard[] {
  return getLaunchThemes().map((theme) => {
    const owned = profile.ownedThemeIds.includes(theme.id);
    const active = profile.activeThemeId === theme.id;
    const action: ShopThemeCard['action'] = active ? 'none' : owned ? 'apply' : theme.priceCoins > 0 ? 'buy' : 'none';
    return {
      id: theme.id,
      displayName: theme.displayName,
      priceCoins: theme.priceCoins,
      owned,
      active,
      action,
    };
  });
}
