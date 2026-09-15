import { getTheme } from '../../theme/ThemeCatalog.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import { getShopCards, type ShopThemeCard } from '../../meta/economy/ShopService.ts';
import type { PlayerProfileV1 } from '../../meta/profile/ProfileTypes.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { themeDisplayName } from '../../i18n/Localization.ts';

export interface ThemeCardViewModel extends ShopThemeCard {
  readonly boardSurface: string;
  readonly slotEdge: string;
  readonly slotHighlight: string;
  readonly cardBackAssetKey: string;
}

export interface ThemesViewModel {
  readonly coins: number;
  readonly activeThemeId: ThemeId;
  readonly cards: readonly ThemeCardViewModel[];
}

export function buildThemesViewModel(profile: PlayerProfileV1, language: AppLanguage = 'ru'): ThemesViewModel {
  return {
    coins: profile.coins,
    activeThemeId: profile.activeThemeId,
    cards: getShopCards(profile).map((card) => {
      const theme = getTheme(card.id);
      return {
        ...card,
        displayName: themeDisplayName(language, card.id),
        boardSurface: theme.board.surface,
        slotEdge: theme.slots.edge,
        slotHighlight: theme.slots.highlight,
        cardBackAssetKey: theme.cardBack.assetKey,
      };
    }),
  };
}
