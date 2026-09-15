import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { StandardDifficulty } from '../../meta/profile/ProfileTypes.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { CoinPill } from '../components/CoinPill.ts';
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

export class HomeScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private viewModel: HomeViewModel | null = null;
  private primary: ActionCard | null = null;
  private newDeal: ActionCard | null = null;
  private daily: ActionCard | null = null;
  private mastery: ActionCard | null = null;
  private themes: ActionCard | null = null;
  private difficulty: SegmentedControl<StandardDifficulty> | null = null;
  private coinPill: CoinPill | null = null;
  private serviceButtons: IconButton[] = [];
  private brandGraphics: Phaser.GameObjects.Graphics | null = null;
  private brandImage: Phaser.GameObjects.Image | null = null;
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
      enabled: true,
    }, () => this.openStandard(), 20);
    if (vm.primary.hasSave) {
      this.newDeal = new ActionCard(this, viewport, {
        title: vm.newDeal.title,
        enabled: true,
      }, () => this.startSelectedStandard(), 20);
    }
    this.daily = new ActionCard(this, viewport, {
      title: vm.daily.title,
      subtitle: vm.daily.subtitle,
      enabled: vm.daily.enabled,
    }, () => this.navigation?.go('daily'), 20);
    this.mastery = new ActionCard(this, viewport, {
      title: vm.mastery.title,
      subtitle: vm.mastery.subtitle,
      enabled: vm.mastery.enabled,
    }, () => this.navigation?.go('mastery'), 20);
    this.themes = new ActionCard(this, viewport, {
      title: tr(getRuntimeServices().language, 'home.themes'),
      subtitle: vm.themes.subtitle,
      enabled: vm.themes.enabled,
    }, () => this.navigation?.go('themes'), 20);
    this.difficulty = new SegmentedControl(
      this,
      viewport,
      (['easy', 'medium', 'hard'] as const).map((value) => ({ value, label: difficultySelectorLabel(getRuntimeServices().language, value) })),
      getRuntimeServices().repository.current.selectedStandardDifficulty,
      (value) => this.selectDifficulty(value),
      30,
    );
    this.coinPill = new CoinPill(this, 30);
    this.coinPill.setCoins(vm.coins);
    this.serviceButtons = [
      new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.leaderboard, enabled: vm.leaderboardsEnabled }, () => this.navigation?.go('leaderboards'), 30),
      new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.howToPlay, enabled: true }, () => this.scene.start('HowToPlayScene'), 30),
      new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.settings, enabled: true }, () => this.scene.start('SettingsScene'), 30),
    ];
    this.createBrandPlaceholder();
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.primary) return;
    const home = computeHomeLayout(viewport);
    for (const component of [this.primary, this.daily, this.mastery, this.themes]) component?.setViewport(viewport);
    this.difficulty?.setViewport(viewport);
    for (const button of this.serviceButtons) button.setViewport(viewport);

    this.primary.layout(home.continuePrimary);
    if (this.newDeal) {
      this.difficulty?.layout(home.difficultySelector);
      this.newDeal.layout(home.newDealAction);
    } else {
      this.difficulty?.layout(home.newDealRow);
    }
    this.daily?.layout(home.daily);
    this.mastery?.layout(home.mastery);
    this.themes?.layout(home.themes);
    this.coinPill?.layout(home.coinPill);

    const gap = Math.max(6, home.serviceActions.height * 0.14);
    const buttonWidth = (home.serviceActions.width - gap * 2) / 3;
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
    this.viewModel = buildHomeViewModel(runtime.repository.current, undefined, runtime.leaderboards.available, runtime.language);
  }

  private openStandard(): void {
    const profile = getRuntimeServices().repository.current;
    if (profile.activeStandard) {
      this.navigation?.go('standard', { mode: 'resume-standard' });
      return;
    }
    this.navigation?.go('standard', {
      mode: 'new-standard',
      difficulty: profile.selectedStandardDifficulty,
    });
  }

  private startSelectedStandard(): void {
    const profile = getRuntimeServices().repository.current;
    if (profile.activeStandard) {
      this.confirmNewDeal();
      return;
    }
    this.navigation?.go('standard', {
      mode: 'new-standard',
      difficulty: profile.selectedStandardDifficulty,
    });
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
      const difficulty = getRuntimeServices().repository.current.selectedStandardDifficulty;
      this.closeNewDealConfirmation();
      this.navigation?.go('standard', { mode: 'new-standard', difficulty });
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
    const repository = runtime.repository;
    void repository.mutate((profile) => ({ ...profile, selectedStandardDifficulty })).then(() => {
      runtime.analytics.track('standard_difficulty_selected', { difficulty: selectedStandardDifficulty });
      if (!this.isUiSceneActive()) return;
      this.refreshViewModel();
      const vm = this.requireViewModel();
      this.difficulty?.setSelected(selectedStandardDifficulty);
      this.primary?.setState({
        title: vm.primary.title,
        subtitle: vm.primary.subtitle,
        enabled: true,
      });
      this.newDeal?.setState({ title: vm.newDeal.title, enabled: true });
      this.coinPill?.setCoins(vm.coins);
      this.requestUiLayout();
    });
  }

  private createBrandPlaceholder(): void {
    if (this.textures.exists(UI_TOKENS.asset.homeBackground)) {
      this.brandImage = this.add.image(0, 0, UI_TOKENS.asset.homeBackground).setOrigin(0).setDepth(1);
    } else {
      this.brandGraphics = this.add.graphics().setDepth(1);
    }
    this.brandTitle = this.add.text(0, 0, 'TRIFOLD', {
      color: '#eadfc7',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(3);
    this.brandSubtitle = this.add.text(0, 0, tr(getRuntimeServices().language, 'home.subtitle'), {
      color: '#aebeb7',
      fontFamily: 'system-ui, sans-serif',
    }).setOrigin(0, 0.5).setDepth(3);
  }

  private layoutBrand(bounds: UiRect, viewport: ResolvedUiViewport): void {
    if (this.brandImage) this.brandImage.setPosition(bounds.x, bounds.y).setDisplaySize(bounds.width, bounds.height);
    if (this.brandGraphics) {
      this.brandGraphics.clear();
      this.brandGraphics.fillStyle(0x214c47, 0.55).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 24);
      this.brandGraphics.lineStyle(2, UI_TOKENS.color.gold, 0.24);
      const mountainY = bounds.y + bounds.height * 0.68;
      this.brandGraphics.beginPath()
        .moveTo(bounds.x + bounds.width * 0.04, mountainY)
        .lineTo(bounds.x + bounds.width * 0.28, bounds.y + bounds.height * 0.38)
        .lineTo(bounds.x + bounds.width * 0.46, mountainY)
        .lineTo(bounds.x + bounds.width * 0.68, bounds.y + bounds.height * 0.48)
        .lineTo(bounds.x + bounds.width * 0.94, mountainY)
        .strokePath();
    }
    const titleSize = Math.max(30, Math.min(74, bounds.width * (viewport.profile === 'desktop' ? 0.105 : 0.13)));
    this.brandTitle?.setFontSize(titleSize).setPosition(bounds.x + bounds.width * 0.08, bounds.y + bounds.height * 0.42);
    this.brandSubtitle?.setFontSize(Math.max(12, titleSize * 0.24)).setPosition(
      bounds.x + bounds.width * 0.08,
      bounds.y + bounds.height * 0.51,
    );
  }
}
