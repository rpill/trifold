import Phaser from 'phaser';
import { productBridge } from '../bridge/TrifoldProductBridge.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { tr } from '../../i18n/Localization.ts';
import { ActionCard } from '../components/ActionCard.ts';
import { SegmentedControl } from '../components/SegmentedControl.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { BaseUiScene } from './BaseUiScene.ts';
import { PaperPanel } from '../components/PaperPanel.ts';

interface SettingsLaunchData { readonly returnScene?: string }

export class SettingsScene extends BaseUiScene {
  private returnScene: string | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private stateText: Phaser.GameObjects.Text | null = null;
  private languageText: Phaser.GameObjects.Text | null = null;
  private toggle: ActionCard | null = null;
  private languageControl: SegmentedControl<AppLanguage> | null = null;
  private back: ActionCard | null = null;
  private paper: PaperPanel | null = null;

  constructor() { super('SettingsScene'); }

  init(data: SettingsLaunchData = {}): void {
    this.returnScene = typeof data.returnScene === 'string' ? data.returnScene : null;
  }

  create(): void {
    this.destroyOwnedUi();
    this.cameras.main.setBackgroundColor(UI_TOKENS.color.table);
    const language = productBridge.settingsSnapshot().language;
    const viewport = this.currentUiViewport();
    this.paper = new PaperPanel(this, { depth: -10 });
    this.titleText = this.add.text(0, 0, tr(language, 'settings.title'), { color: '#f2e6c9', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5);
    this.stateText = this.add.text(0, 0, '', { color: '#e7ddc5', fontFamily: 'system-ui, sans-serif' }).setOrigin(0.5);
    this.toggle = new ActionCard(this, viewport, { title: '', enabled: true }, () => { void this.toggleSfx(); }, 20);
    this.languageText = this.add.text(0, 0, tr(language, 'settings.language'), { color: '#e7ddc5', fontFamily: 'system-ui, sans-serif' }).setOrigin(0.5);
    this.languageControl = new SegmentedControl<AppLanguage>(this, viewport, [
      { value: 'ru', label: tr(language, 'settings.russianName') },
      { value: 'en', label: tr(language, 'settings.englishName') },
    ], language, (value) => { void this.selectLanguage(value); }, 20);
    this.back = new ActionCard(this, viewport, { title: tr(language, 'common.back'), enabled: true }, () => this.close(), 20);
    this.refreshState();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOwnedUi());
    this.bindResponsiveLayout();
  }

  protected layout(viewport: ResolvedUiViewport): void {
    if (!this.titleText) return;
    const css = viewport.minTouchTarget / 44;
    const width = Math.min(viewport.width * 0.66, 630 * css);
    const x = (viewport.width - width) / 2;
    const panelHeight = Math.min(viewport.height * 0.90, 520 * css);
    const y = (viewport.height - panelHeight) / 2;
    this.paper?.layout({ x: x - width * 0.12, y, width: width * 1.24, height: panelHeight });
    this.titleText.setColor('#24302e');
    this.stateText?.setColor('#526055');
    this.languageText?.setColor('#526055');
    const height = Math.max(viewport.minTouchTarget, 52 * viewport.uiScale);
    this.titleText.setFontSize(Math.max(22 * css, 34 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.12);
    this.stateText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.26);
    this.toggle?.setViewport(viewport); this.toggle?.layout({ x, y: y + panelHeight * 0.32, width, height });
    this.languageText?.setFontSize(Math.max(14 * css, 18 * viewport.uiScale)).setPosition(viewport.width / 2, y + panelHeight * 0.52);
    this.languageControl?.setViewport(viewport); this.languageControl?.layout({ x, y: y + panelHeight * 0.58, width, height });
    this.back?.setViewport(viewport); this.back?.layout({ x, y: y + panelHeight - height - panelHeight * 0.06, width, height });
  }

  private async toggleSfx(): Promise<void> {
    const settings = productBridge.settingsSnapshot();
    productBridge.setSoundEnabled(!settings.soundEnabled);
    if (!this.isUiSceneActive()) return;
    this.refreshState();
  }

  private async selectLanguage(language: AppLanguage): Promise<void> {
    productBridge.setLanguage(language);
    if (!this.isUiSceneActive()) return;
    this.refreshState();
    this.requestUiLayout();
  }

  private refreshState(): void {
    const settings = productBridge.settingsSnapshot();
    const enabled = settings.soundEnabled;
    const language = settings.language;
    this.titleText?.setText(tr(language, 'settings.title'));
    this.stateText?.setText(tr(language, enabled ? 'settings.soundOn' : 'settings.soundOff'));
    this.toggle?.setState({ title: tr(language, enabled ? 'settings.disableSound' : 'settings.enableSound'), enabled: true });
    this.languageText?.setText(tr(language, 'settings.language'));
    this.languageControl?.setSelected(language);
    this.back?.setState({ title: tr(language, 'common.back'), enabled: true });
  }

  private close(): void {
    const returnScene = this.returnScene;
    if (returnScene && this.scene.isPaused(returnScene)) {
      this.scene.get(returnScene).events.emit('service-overlay-closed');
      this.scene.resume(returnScene);
      this.scene.stop();
      return;
    }
    this.scene.start('HomeScene');
  }

  private destroyOwnedUi(): void {
    this.paper?.destroy(); this.paper = null;
    this.titleText?.destroy(); this.titleText = null;
    this.stateText?.destroy(); this.stateText = null;
    this.languageText?.destroy(); this.languageText = null;
    this.toggle?.destroy(); this.toggle = null;
    this.languageControl?.destroy(); this.languageControl = null;
    this.back?.destroy(); this.back = null;
  }
}
