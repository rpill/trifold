import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { LeaderboardRow } from '../../leaderboards/LeaderboardService.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { IconButton } from '../components/IconButton.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { NavigationController } from '../navigation/NavigationController.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { tr } from '../../i18n/Localization.ts';
import { formatLeaderboardValue } from '../leaderboards/LeaderboardRowFormat.ts';
import { productBridge } from '../bridge/TrifoldProductBridge.ts';

type LeaderboardTab = 'daily' | 'streak' | 'mastery';

export class LeaderboardsScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private back: IconButton | null = null;
  private tabs: SegmentedControl<LeaderboardTab> | null = null;
  private panel: PaperPanel | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private status: Phaser.GameObjects.Text | null = null;
  private rows: Phaser.GameObjects.Text[] = [];
  private signIn: ActionCard | null = null;
  private selected: LeaderboardTab = 'daily';
  private loading = false;
  private authorizing = false;

  constructor() { super('LeaderboardsScene'); }

  create(): void {
    this.resetOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    getRuntimeServices().analytics.track('leaderboard_open');
    this.navigation = new NavigationController(this.scene);
    const language = productBridge.settingsSnapshot().language;
    const viewport = this.currentUiViewport();
    this.back = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.back, enabled: true }, () => this.navigation?.home(), 30);
    this.tabs = new SegmentedControl(this, viewport, [
      { value: 'daily', label: 'Daily' },
      { value: 'streak', label: tr(language, 'leaderboards.streak') },
      { value: 'mastery', label: 'Mastery' },
    ], this.selected, (tab) => { this.selected = tab; this.tabs?.setSelected(tab); void this.refreshRows(); }, 30);
    this.panel = new PaperPanel(this, { depth: 10, textureKey: UI_TOKENS.asset.paperPanel });
    this.title = this.add.text(0, 0, tr(language, 'leaderboards.title'), {
      color: '#eadfc7', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(30);
    this.status = this.add.text(0, 0, '', {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(30);
    this.signIn = new ActionCard(this, viewport, {
      title: tr(language, 'leaderboards.signIn'),
      subtitle: tr(language, 'leaderboards.signInSubtitle'),
      enabled: false,
    }, () => { void this.authorizeAndReload(); }, 30);
    this.updateSignInState();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.resetOwnedUi());
    this.bindResponsiveLayout();
    void this.refreshRows();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.back || !this.tabs || !this.panel || !this.title || !this.status || !this.signIn) return;
    const margin = viewport.safeMargin;
    const headerH = Math.max(viewport.minTouchTarget, viewport.profile === 'desktop' ? 54 : 44);
    this.back.setViewport(viewport);
    this.tabs.setViewport(viewport);
    this.signIn.setViewport(viewport);
    this.back.layout({ x: margin, y: margin, width: headerH, height: headerH });
    this.title.setFontSize(Math.max(22, Math.min(40, headerH * 0.62)))
      .setPosition(viewport.width / 2, margin + headerH / 2);
    const contentX = margin;
    const contentW = viewport.width - margin * 2;
    const tabsY = margin + headerH + 12;
    const tabsH = Math.max(viewport.minTouchTarget, 50);
    this.tabs.layout({ x: contentX, y: tabsY, width: contentW, height: tabsH });
    const panelY = tabsY + tabsH + 12;
    const auth = productBridge.leaderboardSnapshot();
    this.signIn.setVisible(!auth.authorized);
    const authH = auth.authorized ? 0 : Math.max(viewport.minTouchTarget, 64);
    const panelH = Math.max(120, viewport.height - panelY - margin - (authH > 0 ? authH + 12 : 0));
    const panelBounds: UiRect = { x: contentX, y: panelY, width: contentW, height: panelH };
    this.panel.layout(panelBounds);
    this.status.setPosition(panelBounds.x + panelBounds.width / 2, panelBounds.y + panelBounds.height * 0.12)
      .setFontSize(Math.max(13, Math.min(22, panelBounds.width * 0.025)));
    const startY = panelBounds.y + panelBounds.height * 0.24;
    const rowGap = Math.max(24, Math.min(44, panelBounds.height * 0.085));
    this.rows.forEach((row, index) => row.setPosition(panelBounds.x + panelBounds.width * 0.08, startY + index * rowGap)
      .setFontSize(Math.max(12, Math.min(21, panelBounds.width * 0.022))));
    if (authH > 0) this.signIn.layout({ x: contentX, y: panelY + panelH + 12, width: contentW, height: authH });
  }

  private async refreshRows(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const product = productBridge.snapshot();
      const result = await productBridge.loadLeaderboard(this.selected, this.selected === 'daily' ? product.currentDailyId ?? undefined : undefined);
      if (!this.isUiSceneActive()) return;
      this.rebuildRows(result.entries);
      const language = productBridge.settingsSnapshot().language;
      this.status?.setText(result.status === 'ready'
        ? (result.playerEntry ? tr(language, 'leaderboards.yourRank', { rank: result.playerEntry.rank }) : tr(language, 'leaderboards.top'))
        : result.status === 'unavailable' ? tr(language, 'leaderboards.unavailable') : tr(language, 'leaderboards.failed'));
      this.updateSignInState();
      this.requestUiLayout();
    } finally {
      this.loading = false;
    }
  }

  private rebuildRows(entries: readonly LeaderboardRow[]): void {
    for (const row of this.rows) row.destroy();
    const language = productBridge.settingsSnapshot().language;
    this.rows = entries.slice(0, 10).map((entry) => {
      const playerName = entry.publicName.trim() || tr(language, 'leaderboards.player');
      const value = formatLeaderboardValue(this.selected, entry, language);
      return this.add.text(0, 0, `${entry.rank}. ${playerName}   ${value}`,
        { color: '#24302e', fontFamily: 'system-ui, sans-serif' },
      ).setOrigin(0, 0.5).setDepth(20);
    });
  }

  private updateSignInState(): void {
    const auth = productBridge.leaderboardSnapshot();
    const language = productBridge.settingsSnapshot().language;
    this.signIn?.setVisible(!auth.authorized);
    this.signIn?.setState({
      title: tr(language, 'leaderboards.signIn'),
      subtitle: tr(language, auth.available ? 'leaderboards.signInSubtitle' : 'leaderboards.authUnavailable'),
      enabled: auth.authorizationAllowed && !this.authorizing,
    });
  }

  private async authorizeAndReload(): Promise<void> {
    const auth = productBridge.leaderboardSnapshot();
    if (this.authorizing || !auth.authorizationAllowed || auth.authorized) return;

    this.authorizing = true;
    this.updateSignInState();
    this.requestUiLayout();

    let authorized = false;
    try {
      authorized = await productBridge.authorizeLeaderboard();
    } finally {
      this.authorizing = false;
      this.updateSignInState();
      this.requestUiLayout();
    }
    if (!authorized) return;

    getRuntimeServices().analytics.track('auth_success');
    if (this.isUiSceneActive()) await this.refreshRows();
  }

  private resetOwnedUi(): void {
    this.back?.destroy(); this.tabs?.destroy(); this.panel?.destroy(); this.title?.destroy(); this.status?.destroy(); this.signIn?.destroy();
    for (const row of this.rows) row.destroy();
    this.rows = [];
    this.back = null; this.tabs = null; this.panel = null; this.title = null; this.status = null; this.signIn = null; this.navigation = null;
    this.loading = false;
    this.authorizing = false;
  }
}
