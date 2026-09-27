import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { StandardDifficulty } from '../../meta/MetaSave.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { IconButton } from '../components/IconButton.ts';
import { ModalShell } from '../components/ModalShell.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import { computeHomeLayout, type UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { NavigationController } from '../navigation/NavigationController.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { buildHomeViewModel, type HomeViewModel } from '../home/HomeViewModel.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { difficultySelectorLabel, tr } from '../../i18n/Localization.ts';
import { productBridge } from '../bridge/TrifoldProductBridge.ts';

export class HomeScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private viewModel: HomeViewModel | null = null;
  private primary: ActionCard | null = null;
  private newDeal: ActionCard | null = null;
  private daily: ActionCard | null = null;
  private mastery: ActionCard | null = null;
  private leaders: ActionCard | null = null;
  private difficulty: SegmentedControl<StandardDifficulty> | null = null;
  private serviceButtons: IconButton[] = [];
  private unsubscribeBridge: (() => void) | null = null;
  private brandGraphics: Phaser.GameObjects.Graphics | null = null;
  private brandTitle: Phaser.GameObjects.Text | null = null;
  private brandSubtitle: Phaser.GameObjects.Text | null = null;
  private newDealConfirmShell: ModalShell | null = null;
  private newDealConfirmText: Phaser.GameObjects.Text | null = null;
  private newDealConfirmCancel: ActionCard | null = null;
  private newDealConfirmStart: ActionCard | null = null;

  constructor() {
    super('HomeScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    this.navigation = new NavigationController(this.scene);
    this.refreshViewModel();
    const viewport = this.currentUiViewport();
    const vm = this.requireViewModel();

    this.primary = new ActionCard(this, viewport, {
      title: vm.primary.title,
      subtitle: vm.primary.subtitle,
      artwork: 'landscape',
      enabled: true,
    }, () => this.openStandard(), 20);
    this.newDeal = new ActionCard(this, viewport, {
      title: vm.newDeal.title,
      emphasis: 'highlight',
      enabled: true,
    }, () => this.startSelectedStandard(), 20);
    this.daily = new ActionCard(this, viewport, {
      title: vm.daily.title,
      subtitle: vm.daily.subtitle,
      artwork: 'daily',
      enabled: vm.daily.enabled,
    }, () => this.navigation?.go('daily'), 20);
    this.mastery = new ActionCard(this, viewport, {
      title: tr(getRuntimeServices().language, 'mastery.title'),
      subtitle: vm.mastery.subtitle,
      artwork: 'mastery',
      artworkKey: `ui.rank.${vm.mastery.rank}`,
      enabled: vm.mastery.enabled,
    }, () => this.navigation?.go('mastery'), 20);
    this.leaders = new ActionCard(this, viewport, {
      title: vm.leaders.title,
      subtitle: vm.leaders.subtitle,
      artwork: 'leaders',
      artworkKey: UI_ICON_KEYS.leaderboard,
      enabled: vm.leaders.enabled,
    }, () => this.navigation?.go('leaderboards'), 20);
    this.difficulty = new SegmentedControl(
      this,
      viewport,
      (['easy', 'medium', 'hard'] as const).map((value) => ({ value, label: difficultySelectorLabel(getRuntimeServices().language, value) })),
      vm.newDeal.difficulty,
      (value) => this.selectDifficulty(value),
      30,
    );
    this.serviceButtons = [
      new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.howToPlay, enabled: true }, () => this.scene.start('HowToPlayScene'), 30),
      new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.settings, enabled: true }, () => this.scene.start('SettingsScene'), 30),
    ];
    this.createBrandPlaceholder();
    this.unsubscribeBridge = productBridge.subscribe(() => this.refreshFromBridge());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeBridge?.();
      this.unsubscribeBridge = null;
      this.closeNewDealConfirmation();
    });
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.primary) return;
    const home = computeHomeLayout(viewport);
    for (const component of [this.primary, this.newDeal, this.daily, this.mastery, this.leaders]) component?.setViewport(viewport);
    this.difficulty?.setViewport(viewport);
    for (const button of this.serviceButtons) button.setViewport(viewport);

    this.primary.layout(home.continuePrimary);
    this.difficulty?.layout(home.difficultySelector);
    this.newDeal?.layout(home.newDealAction);
    this.daily?.layout(home.daily);
    this.mastery?.layout(home.mastery);
    this.leaders?.layout(home.leaders);

    const gap = Math.max(6, home.serviceActions.height * 0.14);
    const buttonWidth = (home.serviceActions.width - gap) / 2;
    this.serviceButtons.forEach((button, index) => button.layout({
      x: home.serviceActions.x + index * (buttonWidth + gap),
      y: home.serviceActions.y,
      width: buttonWidth,
      height: home.serviceActions.height,
    }));
    this.layoutBrand(home.brand, viewport);
    this.layoutNewDealConfirmation(viewport);
  }

  private requireViewModel(): HomeViewModel {
    if (!this.viewModel) throw new Error('Home view model is not ready.');
    return this.viewModel;
  }

  private refreshViewModel(): void {
    const runtime = getRuntimeServices();
    this.viewModel = buildHomeViewModel(productBridge.snapshot(), runtime.language);
  }

  private refreshFromBridge(): void {
    if (!this.isUiSceneActive()) return;
    this.refreshViewModel();
    const vm = this.requireViewModel();
    this.primary?.setState({ title: vm.primary.title, subtitle: vm.primary.subtitle, artwork: 'landscape', enabled: true });
    this.newDeal?.setState({ title: vm.newDeal.title, emphasis: 'highlight', enabled: true });
    this.daily?.setState({ title: vm.daily.title, subtitle: vm.daily.subtitle, artwork: 'daily', enabled: vm.daily.enabled });
    this.mastery?.setState({ title: tr(getRuntimeServices().language, 'mastery.title'), subtitle: vm.mastery.subtitle, artwork: 'mastery', artworkKey: `ui.rank.${vm.mastery.rank}`, enabled: vm.mastery.enabled });
    this.leaders?.setState({ title: vm.leaders.title, subtitle: vm.leaders.subtitle, artwork: 'leaders', artworkKey: UI_ICON_KEYS.leaderboard, enabled: vm.leaders.enabled });
    this.difficulty?.setSelected(vm.newDeal.difficulty);
    this.requestUiLayout();
  }

  private openStandard(): void {
    const vm = this.requireViewModel();
    if (vm.primary.hasActiveGame) {
      productBridge.resumeGame();
      return;
    }
    void productBridge.startStandard(vm.newDeal.difficulty);
  }

  private startSelectedStandard(): void {
    const vm = this.requireViewModel();
    if (vm.primary.hasActiveGame) {
      this.confirmNewDeal();
      return;
    }
    void productBridge.startStandard(vm.newDeal.difficulty);
  }

  private confirmNewDeal(): void {
    if (this.newDealConfirmShell) return;
    const viewport = this.currentUiViewport();
    const language = getRuntimeServices().language;
    this.newDealConfirmShell = new ModalShell(this, tr(language, 'home.confirmNewTitle'), () => this.closeNewDealConfirmation(), 5000);
    this.newDealConfirmText = this.add.text(0, 0, tr(language, 'home.confirmNewBody'), {
      color: '#64706a',
      fontFamily: 'system-ui, sans-serif',
      align: 'center',
      wordWrap: { width: Math.max(1, viewport.width * 0.42) },
    }).setOrigin(0.5).setDepth(5002);
    this.newDealConfirmCancel = new ActionCard(this, viewport, { title: tr(language, 'common.cancel'), enabled: true }, () => {
      this.closeNewDealConfirmation();
    }, 5002);
    this.newDealConfirmStart = new ActionCard(this, viewport, { title: tr(language, 'common.newDeal'), emphasis: 'highlight', enabled: true }, () => {
      const difficulty = this.requireViewModel().newDeal.difficulty;
      this.closeNewDealConfirmation();
      void productBridge.startStandard(difficulty);
    }, 5002);
    this.layoutNewDealConfirmation(viewport);
  }

  private closeNewDealConfirmation(): void {
    this.newDealConfirmShell?.destroy();
    this.newDealConfirmText?.destroy();
    this.newDealConfirmCancel?.destroy();
    this.newDealConfirmStart?.destroy();
    this.newDealConfirmShell = null;
    this.newDealConfirmText = null;
    this.newDealConfirmCancel = null;
    this.newDealConfirmStart = null;
  }

  private layoutNewDealConfirmation(viewport: ResolvedUiViewport): void {
    if (!this.newDealConfirmShell || !this.newDealConfirmText || !this.newDealConfirmCancel || !this.newDealConfirmStart) return;
    this.newDealConfirmCancel.setViewport(viewport);
    this.newDealConfirmStart.setViewport(viewport);
    const scale = viewport.minTouchTarget / 44;
    const width = Math.min(viewport.width * (viewport.profile === 'desktop' ? 0.42 : 0.68), 680 * scale);
    const height = Math.min(viewport.height * 0.62, Math.max(240 * scale, viewport.minTouchTarget * 4.8));
    const bounds: UiRect = {
      x: (viewport.width - width) / 2,
      y: (viewport.height - height) / 2,
      width,
      height,
    };
    this.newDealConfirmShell.layout(viewport.width, viewport.height, bounds);
    this.newDealConfirmText.setWordWrapWidth(bounds.width * 0.78)
      .setFontSize(Math.max(12 * scale, Math.min(20 * scale, bounds.height * 0.07)))
      .setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.44);
    const gap = Math.max(8 * scale, viewport.minTouchTarget * 0.18);
    const buttonHeight = Math.max(viewport.minTouchTarget, bounds.height * 0.19);
    const innerWidth = bounds.width * 0.78;
    const buttonWidth = (innerWidth - gap) / 2;
    const buttonY = bounds.y + bounds.height - buttonHeight - bounds.height * 0.10;
    const buttonX = bounds.x + (bounds.width - innerWidth) / 2;
    this.newDealConfirmCancel.layout({ x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight });
    this.newDealConfirmStart.layout({ x: buttonX + buttonWidth + gap, y: buttonY, width: buttonWidth, height: buttonHeight });
  }

  private selectDifficulty(selectedStandardDifficulty: StandardDifficulty): void {
    const runtime = getRuntimeServices();
    void productBridge.setStandardDifficulty(selectedStandardDifficulty).then(() => {
      runtime.analytics.track('standard_difficulty_selected', { difficulty: selectedStandardDifficulty });
      this.refreshFromBridge();
    });
  }

  private createBrandPlaceholder(): void {
    // UI_TOKENS.asset.homeBackground is composed by BaseUiScene without stretching.
    this.brandGraphics = this.add.graphics().setDepth(1);
    this.brandTitle = this.add.text(0, 0, 'TRIFOLD', {
      color: '#e8c88a',
      fontFamily: 'Georgia, serif',
      fontStyle: 'normal',
    }).setOrigin(0, 0.5).setDepth(3);
    this.brandSubtitle = this.add.text(0, 0, tr(getRuntimeServices().language, 'home.subtitle'), {
      color: '#e3d5b5',
      fontFamily: 'Georgia, serif',
    }).setOrigin(0, 0.5).setDepth(3);
  }

  private layoutBrand(bounds: UiRect, viewport: ResolvedUiViewport): void {
    if (this.brandGraphics) {
      this.brandGraphics.clear();
      const cx = bounds.x + bounds.width * 0.48;
      const cy = bounds.y + bounds.height * 0.34;
      const r = Math.max(4, bounds.width * 0.012);
      this.brandGraphics.lineStyle(Math.max(1, viewport.minTouchTarget / 44), UI_TOKENS.color.gold, 0.85)
        .lineBetween(bounds.x + bounds.width * 0.12, cy, cx - r * 3, cy)
        .lineBetween(cx + r * 3, cy, bounds.x + bounds.width * 0.84, cy);
      for (const dx of [-r * 1.5, 0, r * 1.5]) this.brandGraphics.beginPath().moveTo(cx + dx, cy - r).lineTo(cx + dx + r, cy).lineTo(cx + dx, cy + r).lineTo(cx + dx - r, cy).closePath().strokePath();
    }
    const titleSize = bounds.width * 0.135;
    this.brandTitle?.setOrigin(0.5).setLetterSpacing(titleSize * 0.08).setFontSize(titleSize).setPosition(bounds.x + bounds.width * 0.48, bounds.y + bounds.height * 0.29);
    this.brandSubtitle?.setOrigin(0.5).setFontSize(Math.max(11 * viewport.minTouchTarget / 44, titleSize * 0.23)).setPosition(
      bounds.x + bounds.width * 0.48,
      bounds.y + bounds.height * 0.385,
    );
  }
}
