import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { tr } from '../../i18n/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';

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

  constructor() { super('HowToPlayScene'); }

  create(): void {
    this.destroyOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const language = getRuntimeServices().language;
    const viewport = this.currentUiViewport();
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
    const margin = viewport.safeMargin;
    const contentWidth = Math.min(viewport.width - margin * 2, 900 * viewport.uiScale);
    const x = (viewport.width - contentWidth) / 2;
    const cardHeight = Math.max(48 * viewport.uiScale, viewport.minTouchTarget);
    this.titleText.setFontSize(Math.max(24, 34 * viewport.uiScale)).setPosition(viewport.width / 2, margin + 32 * viewport.uiScale);
    this.counterText?.setFontSize(Math.max(12, 15 * viewport.uiScale)).setPosition(viewport.width / 2, margin + 72 * viewport.uiScale);
    this.bodyText.setFontSize(Math.max(15, 22 * viewport.uiScale)).setWordWrapWidth(contentWidth * 0.86).setPosition(viewport.width / 2, viewport.height * 0.42);
    const bottomY = viewport.height - margin - cardHeight;
    this.back?.setViewport(viewport); this.back?.layout({ x, y: bottomY, width: contentWidth * 0.20, height: cardHeight });
    this.prev?.setViewport(viewport); this.prev?.layout({ x: x + contentWidth * 0.23, y: bottomY, width: contentWidth * 0.12, height: cardHeight });
    this.next?.setViewport(viewport); this.next?.layout({ x: x + contentWidth * 0.37, y: bottomY, width: contentWidth * 0.12, height: cardHeight });
    this.replay?.setViewport(viewport); this.replay?.layout({ x: x + contentWidth * 0.52, y: bottomY, width: contentWidth * 0.48, height: cardHeight });
  }

  private changePage(delta: number): void {
    const pages = rulePages(getRuntimeServices().language);
    this.pageIndex = (this.pageIndex + delta + pages.length) % pages.length;
    this.refreshPage();
  }

  private refreshPage(): void {
    const pages = rulePages(getRuntimeServices().language);
    const page = pages[this.pageIndex];
    if (!page) return;
    this.titleText?.setText(page.title);
    this.counterText?.setText(`${this.pageIndex + 1} / ${pages.length}`);
    this.bodyText?.setText(page.body);
  }

  private destroyOwnedUi(): void {
    this.titleText?.destroy(); this.titleText = null;
    this.counterText?.destroy(); this.counterText = null;
    this.bodyText?.destroy(); this.bodyText = null;
    this.back?.destroy(); this.back = null;
    this.prev?.destroy(); this.prev = null;
    this.next?.destroy(); this.next = null;
    this.replay?.destroy(); this.replay = null;
  }
}
