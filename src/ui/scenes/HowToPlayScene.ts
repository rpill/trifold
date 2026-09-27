import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { tr } from '../../i18n/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';

function rulePages(language: AppLanguage) {
  return [
    { title: tr(language, 'how.sequenceTitle'), body: tr(language, 'how.sequenceBody') },
    { title: tr(language, 'how.freeCellTitle'), body: tr(language, 'how.freeCellBody') },
    { title: tr(language, 'how.flowerTitle'), body: tr(language, 'how.flowerBody') },
    { title: tr(language, 'how.foundationTitle'), body: tr(language, 'how.foundationBody') },
    { title: tr(language, 'how.dragonsTitle'), body: tr(language, 'how.dragonsBody') },
    { title: tr(language, 'how.undoTitle'), body: tr(language, 'how.undoBody') },
  ] as const;
}

export class HowToPlayScene extends BaseUiScene {
  private pageIndex = 0;
  private titleText: Phaser.GameObjects.Text | null = null;
  private counterText: Phaser.GameObjects.Text | null = null;
  private bodyText: Phaser.GameObjects.Text | null = null;
  private back: ActionCard | null = null;
  private prev: ActionCard | null = null;
  private next: ActionCard | null = null;
  private replay: ActionCard | null = null;
  private paper: PaperPanel | null = null;
  private illustration: Phaser.GameObjects.Image | null = null;
  private cards: Phaser.GameObjects.Image[] = [];

  constructor() { super('HowToPlayScene'); }

  create(): void {
    this.destroyOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const language = getRuntimeServices().language;
    const viewport = this.currentUiViewport();
    this.paper = new PaperPanel(this, { depth: -10 });
    this.illustration = this.add.image(0, 0, UI_ICON_KEYS.howToPlay).setTint(UI_TOKENS.color.gold);
    this.cards = [9, 8, 7].map((rank, i) => this.add.image(0, 0, `card.face.number.${i === 1 ? 'bamboo' : 'coins'}.${rank}@2x`).setDepth(2 + i));
    this.titleText = this.add.text(0, 0, '', { color: '#f2e6c9', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5);
    this.counterText = this.add.text(0, 0, '', { color: '#c7b98f', fontFamily: 'system-ui, sans-serif' }).setOrigin(0.5);
    this.bodyText = this.add.text(0, 0, '', { color: '#e7ddc5', fontFamily: 'system-ui, sans-serif', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.back = new ActionCard(this, viewport, { title: tr(language, 'common.back'), enabled: true }, () => this.scene.start('HomeScene'), 20);
    this.prev = new ActionCard(this, viewport, { title: '←', enabled: true }, () => this.changePage(-1), 20);
    this.next = new ActionCard(this, viewport, { title: '→', enabled: true }, () => this.changePage(1), 20);
    this.replay = new ActionCard(this, viewport, { title: tr(language, 'how.replayTutorial'), enabled: true }, () => this.scene.start('GameScene', { mode: 'tutorial' }), 20);
    this.refreshPage();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOwnedUi());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.titleText || !this.bodyText) return;
    const css = viewport.minTouchTarget / 44;
    const margin = viewport.safeMargin;
    const panelHeight = Math.min(viewport.height - margin * 2, 620 * css);
    const top = (viewport.height - panelHeight) / 2;
    const contentWidth = Math.min((viewport.width - margin * 2) / 1.12, 820 * css);
    const x = (viewport.width - contentWidth) / 2;
    this.paper?.layout({ x: x - contentWidth * 0.06, y: top, width: contentWidth * 1.12, height: panelHeight });
    this.titleText.setColor('#24302e');
    this.counterText?.setColor('#846b3b');
    this.bodyText.setColor('#43534a');
    const emblem = Math.min(viewport.height * 0.16, 92 * viewport.uiScale);
    this.illustration?.setPosition(viewport.width / 2, top + panelHeight * 0.36).setDisplaySize(emblem, emblem).setVisible(this.pageIndex !== 0);
    const cardHeight = panelHeight * 0.22;
    this.cards.forEach((card, i) => card.setVisible(this.pageIndex === 0).setDisplaySize(cardHeight * 0.65, cardHeight).setPosition(viewport.width / 2, top + panelHeight * (0.34 + i * 0.060)));
    const buttonHeight = Math.max(48 * viewport.uiScale, viewport.minTouchTarget);
    this.titleText.setFontSize(Math.max(22 * css, 32 * viewport.uiScale)).setPosition(viewport.width / 2, top + panelHeight * 0.10);
    this.counterText?.setFontSize(Math.max(12 * css, 15 * viewport.uiScale)).setPosition(viewport.width / 2, top + panelHeight * 0.18);
    this.bodyText.setFontSize(Math.max(13 * css, 20 * viewport.uiScale)).setWordWrapWidth(contentWidth * 0.86).setPosition(viewport.width / 2, top + panelHeight * 0.64);
    const bottomY = top + panelHeight - buttonHeight - panelHeight * 0.045;
    this.back?.setViewport(viewport); this.back?.layout({ x, y: bottomY, width: contentWidth * 0.20, height: buttonHeight });
    this.prev?.setViewport(viewport); this.prev?.layout({ x: x + contentWidth * 0.23, y: bottomY, width: contentWidth * 0.12, height: buttonHeight });
    this.next?.setViewport(viewport); this.next?.layout({ x: x + contentWidth * 0.37, y: bottomY, width: contentWidth * 0.12, height: buttonHeight });
    this.replay?.setViewport(viewport); this.replay?.layout({ x: x + contentWidth * 0.52, y: bottomY, width: contentWidth * 0.48, height: buttonHeight });
  }

  private changePage(delta: number): void {
    const pages = rulePages(getRuntimeServices().language);
    this.pageIndex = (this.pageIndex + delta + pages.length) % pages.length;
    this.refreshPage();
    this.requestUiLayout();
  }

  private refreshPage(): void {
    const pages = rulePages(getRuntimeServices().language);
    const page = pages[this.pageIndex];
    if (!page) return;
    this.titleText?.setText(page.title);
    this.counterText?.setText(`${this.pageIndex + 1} / ${pages.length}`);
    this.bodyText?.setText(page.body);
    const icons = [UI_ICON_KEYS.howToPlay, UI_ICON_KEYS.archive, UI_ICON_KEYS.info, UI_ICON_KEYS.mastery, UI_ICON_KEYS.laurel, UI_ICON_KEYS.undo];
    this.illustration?.setTexture(icons[this.pageIndex]!);
  }

  private destroyOwnedUi(): void {
    this.paper?.destroy(); this.paper = null;
    this.illustration?.destroy(); this.illustration = null;
    this.cards.forEach(card => card.destroy()); this.cards = [];
    this.titleText?.destroy(); this.titleText = null;
    this.counterText?.destroy(); this.counterText = null;
    this.bodyText?.destroy(); this.bodyText = null;
    this.back?.destroy(); this.back = null;
    this.prev?.destroy(); this.prev = null;
    this.next?.destroy(); this.next = null;
    this.replay?.destroy(); this.replay = null;
  }
}
