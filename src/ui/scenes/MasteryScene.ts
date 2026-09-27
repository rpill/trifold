import Phaser from 'phaser';
import { IconButton } from '../components/IconButton.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { buildMasteryViewModel, type MasteryViewModel } from '../mastery/MasteryViewModel.ts';
import { NavigationController } from '../navigation/NavigationController.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { tr } from '../../i18n/Localization.ts';
import { ProgressMeter } from '../components/ProgressMeter.ts';
import { productBridge } from '../bridge/TrifoldProductBridge.ts';

export class MasteryScene extends BaseUiScene {
  private navigation: NavigationController | null = null;
  private vm: MasteryViewModel | null = null;
  private leftPanel: PaperPanel | null = null;
  private rightPanel: PaperPanel | null = null;
  private back: IconButton | null = null;
  private badge: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private subtitle: Phaser.GameObjects.Text | null = null;
  private requirementTexts: Phaser.GameObjects.Text[] = [];
  private pathTexts: Phaser.GameObjects.Text[] = [];
  private pathBadges: Phaser.GameObjects.Image[] = [];
  private meters: ProgressMeter[] = [];
  private heading: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('MasteryScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    this.navigation = new NavigationController(this.scene);
    const product = productBridge.snapshot();
    const language = productBridge.settingsSnapshot().language;
    this.vm = buildMasteryViewModel(product.state, language);
    this.heading = this.add.text(0, 0, tr(language, 'mastery.title'), { fontFamily: 'Georgia, serif', color: '#ecd29b' }).setOrigin(0.5).setDepth(20);
    const viewport = this.currentUiViewport();
    this.leftPanel = new PaperPanel(this, { depth: 10, textureKey: UI_TOKENS.asset.paperPanel });
    this.rightPanel = new PaperPanel(this, { depth: 10, textureKey: UI_TOKENS.asset.paperPanel });
    this.back = new IconButton(this, viewport, { iconKey: UI_ICON_KEYS.back, enabled: true }, () => {
      if (this.navigation) this.navigation.home();
    }, 30);

    const badgeKey = 'ui.rank.' + this.vm.rank;
    if (this.textures.exists(badgeKey)) {
      this.badge = this.add.image(0, 0, badgeKey).setDepth(20);
    } else {
      this.badge = this.add.graphics().setDepth(20);
    }
    this.title = this.add.text(0, 0, this.vm.rankLabel, {
      color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.subtitle = this.add.text(0, 0, this.vm.requirements.length > 0 ? tr(language, 'mastery.nextRank') : tr(language, 'mastery.maxRank'), {
      color: '#64706a', fontFamily: 'system-ui, sans-serif', align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.requirementTexts = this.vm.requirements.map((requirement) => this.add.text(0, 0,
      `${requirement.label}: ${requirement.current} / ${requirement.total}`,
      { color: '#24302e', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold' },
    ).setOrigin(0, 0.5).setDepth(20));
    this.pathTexts = this.vm.path.map((item) => this.add.text(0, 0, item.label, {
      color: item.current ? '#7a642f' : item.completed ? '#405d55' : '#7b817c',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: item.current ? 'bold' : 'normal',
      align: 'center',
    }).setOrigin(0.5).setDepth(20));
    this.pathBadges = this.vm.path.map(item => this.add.image(0, 0, `ui.rank.${item.rank}`).setAlpha(item.current || item.completed ? 1 : 0.36).setDepth(20));
    this.meters = this.vm.requirements.map(requirement => {
      const meter = new ProgressMeter(this, 20);
      meter.setProgress(requirement);
      return meter;
    });

    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.vm || !this.leftPanel || !this.rightPanel) return;
    this.back?.setViewport(viewport);
    const css = viewport.minTouchTarget / 44;
    const margin = Math.max(viewport.safeMargin, (viewport.width - 1200 * css) / 2);
    const gap = viewport.profile === 'desktop' ? Math.max(20, viewport.width * 0.018) : 12;
    const header = (viewport.profile === 'desktop' ? 54 : 44) * css;
    this.heading?.setFontSize(28 * viewport.uiScale).setPosition(viewport.width / 2, margin + header / 2);
    const height = Math.min(viewport.height - viewport.safeMargin * 2 - header - gap, 600 * css);
    const top = (viewport.height - height + header) / 2;
    this.heading?.setPosition(viewport.width / 2, top - header * 0.7);
    const leftWidth = viewport.profile === 'desktop'
      ? (viewport.width - margin * 2 - gap) * 0.40
      : (viewport.width - margin * 2 - gap) * 0.42;
    const rightWidth = viewport.width - margin * 2 - gap - leftWidth;
    const left: UiRect = { x: margin, y: top, width: leftWidth, height };
    const right: UiRect = { x: left.x + left.width + gap, y: top, width: rightWidth, height };
    this.leftPanel.layout({ x: left.x, y: left.y, width: viewport.width - margin * 2, height });
    this.rightPanel.setVisible(false);
    this.back?.layout({ x: margin, y: top - header - gap * 0.5, width: header, height: header });

    const badgeSize = Math.min(left.width * 0.42, left.height * 0.34);
    if (this.badge instanceof Phaser.GameObjects.Image) {
      this.badge.setPosition(left.x + left.width / 2, left.y + left.height * 0.25).setDisplaySize(badgeSize, badgeSize);
    } else if (this.badge instanceof Phaser.GameObjects.Graphics) {
      this.badge.clear();
      this.badge.fillStyle(UI_TOKENS.color.gold, 0.22)
        .fillCircle(left.x + left.width / 2, left.y + left.height * 0.25, badgeSize / 2);
      this.badge.lineStyle(2, UI_TOKENS.color.gold, 0.85)
        .strokeCircle(left.x + left.width / 2, left.y + left.height * 0.25, badgeSize / 2);
    }
    this.title?.setPosition(left.x + left.width / 2, left.y + left.height * 0.53)
      .setFontSize(Math.max(22, Math.min(42, left.width * 0.08)));
    this.subtitle?.setPosition(left.x + left.width / 2, left.y + left.height * 0.62)
      .setFontSize(Math.max(12, Math.min(20, left.width * 0.04)));

    const reqStartY = right.y + right.height * 0.18;
    const reqGap = Math.min(88 * css, right.height * 0.18);
    this.requirementTexts.forEach((text, index) => {
      text.setPosition(right.x + right.width * 0.10, reqStartY + index * reqGap)
        .setFontSize(Math.max(14 * css, Math.min(26 * css, right.width * 0.045)));
      this.meters[index]?.layout({ x: right.x + right.width * 0.10, y: reqStartY + index * reqGap + reqGap * 0.30, width: right.width * 0.80, height: Math.max(5 * css, right.height * 0.013) });
    });
    const pathY = right.y + right.height * 0.77;
    const pathWidth = right.width * 0.82;
    const startX = right.x + (right.width - pathWidth) / 2;
    const step = this.pathTexts.length > 1 ? pathWidth / (this.pathTexts.length - 1) : 0;
    this.pathTexts.forEach((text, index) => {
      text.setPosition(startX + index * step, pathY + right.height * 0.08).setFontSize(Math.max(8 * css, Math.min(14 * css, right.width * 0.020)));
      const size = Math.min(step * 0.85, right.height * 0.16);
      this.pathBadges[index]?.setPosition(startX + index * step, pathY - right.height * 0.025).setDisplaySize(size, size);
    });
  }
}
