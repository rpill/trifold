import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import { applyTheme, purchaseTheme } from '../../meta/economy/ShopService.ts';
import { COIN_PACK_AMOUNT, COIN_PACK_PRODUCT_ID, consumeCoinPackPurchase } from '../../meta/economy/CoinPack.ts';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { CoinPill } from '../components/CoinPill.ts';
import { IconButton } from '../components/IconButton.ts';
import { ScrollRegion } from '../components/ScrollRegion.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { NavigationController } from '../navigation/NavigationController.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { ThemeCard } from '../themes/ThemeCard.ts';
import { computeThemesGridLayout } from '../themes/ThemesGridLayout.ts';
import { buildThemesViewModel, type ThemesViewModel } from '../themes/ThemesViewModel.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { tr } from '../../i18n/Localization.ts';

export class ThemesScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private back: IconButton | null = null;
  private coinPill: CoinPill | null = null;
  private coinPack: ActionCard | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private scroll: ScrollRegion | null = null;
  private cards: ThemeCard[] = [];
  private viewModel: ThemesViewModel | null = null;
  private coinPackBusy = false;

  constructor() {
    super('ThemesScene');
  }

  create(): void {
    this.resetOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    getRuntimeServices().analytics.track('shop_open');
    this.navigation = new NavigationController(this.scene);
    const runtime = getRuntimeServices();
    const language = runtime.language;
    const viewport = this.currentUiViewport();
    const payments = runtime.payments;
    this.viewModel = buildThemesViewModel(runtime.repository.current, language);
    this.back = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.back, enabled: true }, () => this.navigation?.home(), 30);
    this.coinPill = new CoinPill(this, 30);
    this.coinPill.setCoins(this.viewModel.coins);
    this.coinPack = new ActionCard(this, viewport, {
      title: tr(language, 'common.coins', { count: COIN_PACK_AMOUNT }),
      subtitle: payments.available ? tr(language, 'themes.buyCoins') : tr(language, 'themes.purchasesUnavailable'),
      enabled: payments.available,
    }, () => { void this.purchaseCoinPack(); }, 30);
    this.title = this.add.text(0, 0, tr(language, 'themes.title'), {
      color: '#eadfc7', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(30);
    this.scroll = new ScrollRegion(this, 20);
    this.rebuildCards();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.resetOwnedUi());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.viewModel || !this.back || !this.coinPill || !this.coinPack || !this.title || !this.scroll) return;
    const layout = computeThemesGridLayout(viewport, this.viewModel.cards.length);
    this.back.setViewport(viewport);
    this.coinPack.setViewport(viewport);
    this.back.layout(layout.back);
    this.coinPill.layout(layout.coinPill);
    this.coinPack.layout(layout.coinPack);
    this.title.setFontSize(Math.max(22, Math.min(40, layout.title.height * 0.54)))
      .setPosition(layout.title.x + layout.title.width / 2, layout.title.y + layout.title.height / 2);
    this.scroll.layout(layout.content);
    this.scroll.setContentHeight(layout.contentHeight);
    this.cards.forEach((card, index) => {
      const bounds = layout.cards[index];
      if (bounds) card.layout(bounds);
    });
  }

  private async handleThemeAction(themeId: ThemeId): Promise<void> {
    const services = getRuntimeServices();
    const current = services.repository.current;
    const card = buildThemesViewModel(current, services.language).cards.find((entry) => entry.id === themeId);
    if (!card || card.action === 'none') return;

    if (card.action === 'buy') {
      let purchased = false;
      await services.repository.mutate((profile) => {
        const result = purchaseTheme(profile, themeId);
        purchased = result.status === 'purchased';
        return result.profile;
      });
      if (purchased) services.analytics.track('theme_purchase', { themeId, priceCoins: card.priceCoins });
    } else {
      let applied = false;
      const next = await services.repository.mutate((profile) => {
        const result = applyTheme(profile, themeId);
        applied = result.status === 'applied';
        return result.profile;
      });
      services.theme.setTheme(next.activeThemeId);
      if (applied) services.analytics.track('theme_apply', { themeId });
    }
    if (!this.isUiSceneActive()) return;
    this.refreshFromProfile();
  }

  private async purchaseCoinPack(): Promise<void> {
    if (this.coinPackBusy) return;
    const services = getRuntimeServices();
    const payments = services.payments;
    if (!payments.available) return;
    this.coinPackBusy = true;
    this.syncCoinPackState();
    try {
      const purchase = await payments.purchase(COIN_PACK_PRODUCT_ID);
      await services.repository.mutate((profile) => consumeCoinPackPurchase(profile, purchase));
      services.analytics.track('coin_pack_purchase', { productId: purchase.productId, coins: COIN_PACK_AMOUNT });
      if (this.isUiSceneActive()) this.refreshFromProfile();
      try {
        await payments.consume(purchase.purchaseToken);
      } catch (error) {
        console.warn('[Trifold] coin pack granted but purchase token was not consumed yet', error);
      }
    } catch (error) {
      console.error('[Trifold] coin pack purchase failed', error);
    } finally {
      this.coinPackBusy = false;
      if (this.isUiSceneActive()) {
        this.syncCoinPackState();
        this.requestUiLayout();
      }
    }
  }

  private syncCoinPackState(): void {
    const runtime = getRuntimeServices();
    const payments = runtime.payments;
    const language = runtime.language;
    this.coinPack?.setState({
      title: tr(language, 'common.coins', { count: COIN_PACK_AMOUNT }),
      subtitle: !payments.available ? tr(language, 'themes.purchasesUnavailable') : this.coinPackBusy ? tr(language, 'themes.purchasing') : tr(language, 'themes.buyCoins'),
      enabled: payments.available && !this.coinPackBusy,
    });
  }

  private refreshFromProfile(): void {
    const runtime = getRuntimeServices();
    this.viewModel = buildThemesViewModel(runtime.repository.current, runtime.language);
    this.coinPill?.setCoins(this.viewModel.coins);
    this.cards.forEach((card) => {
      const state = this.viewModel?.cards.find((entry) => entry.id === card.id);
      if (state) card.setState(state);
    });
    this.requestUiLayout();
  }

  private rebuildCards(): void {
    if (!this.scroll || !this.viewModel) return;
    for (const card of this.cards) card.destroy();
    this.cards.length = 0;
    for (const state of this.viewModel.cards) {
      const card = new ThemeCard(this, state, (id) => { void this.handleThemeAction(id); }, getRuntimeServices().language);
      this.scroll.add(card.gameObject());
      this.cards.push(card);
    }
  }

  private resetOwnedUi(): void {
    this.back?.destroy();
    this.coinPill?.destroy();
    this.coinPack?.destroy();
    this.title?.destroy();
    this.scroll?.destroy();
    this.back = null;
    this.coinPill = null;
    this.coinPack = null;
    this.title = null;
    this.scroll = null;
    this.cards.length = 0;
    this.viewModel = null;
    this.navigation = null;
    this.coinPackBusy = false;
  }
}
