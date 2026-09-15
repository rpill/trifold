import Phaser from 'phaser';
import type { ThemeId } from '../../theme/ThemeDefinition.ts';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import type { ThemeCardViewModel } from './ThemesViewModel.ts';
import { isPressGesture, type PointerPoint } from './ThemeCardPress.ts';
import type { AppLanguage } from '../../i18n/Language.ts';
import { tr } from '../../i18n/Localization.ts';

function color(value: string): number {
  return Number.parseInt(value.replace('#', ''), 16);
}

export class ThemeCard {
  readonly id: ThemeId;
  private readonly container: Phaser.GameObjects.Container;
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly preview: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly action: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private state: ThemeCardViewModel;
  private readonly onPress: (id: ThemeId) => void;
  private readonly language: AppLanguage;
  private pressStart: PointerPoint | null = null;

  constructor(scene: Phaser.Scene, state: ThemeCardViewModel, onPress: (id: ThemeId) => void, language: AppLanguage = 'ru') {
    this.id = state.id;
    this.state = state;
    this.onPress = onPress;
    this.language = language;
    this.container = scene.add.container(0, 0);
    this.surface = scene.add.graphics();
    this.preview = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', { color: '#24302e', fontFamily: 'Georgia, serif', fontStyle: 'bold' }).setOrigin(0.5);
    this.status = scene.add.text(0, 0, '', { color: '#64706a', fontFamily: 'system-ui, sans-serif' }).setOrigin(0.5);
    this.action = scene.add.text(0, 0, '', { color: '#7a642f', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold' }).setOrigin(0.5);
    this.zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setInteractive();
    this.zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pressStart = { x: pointer.x, y: pointer.y };
    });
    this.zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const start = this.pressStart;
      this.pressStart = null;
      if (!start || this.state.action === 'none') return;
      if (isPressGesture(start, { x: pointer.x, y: pointer.y })) this.onPress(this.id);
    });
    this.zone.on('pointerout', () => {
      this.pressStart = null;
    });
    this.container.add([this.surface, this.preview, this.title, this.status, this.action, this.zone]);
    this.syncText();
  }

  gameObject(): Phaser.GameObjects.Container {
    return this.container;
  }

  setState(state: ThemeCardViewModel): void {
    this.state = state;
    this.syncText();
  }

  layout(bounds: UiRect): void {
    const radius = Math.max(8, bounds.height * 0.055);
    this.surface.clear()
      .fillStyle(this.state.active ? UI_TOKENS.color.paperPressed : UI_TOKENS.color.paper, 1)
      .fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius)
      .lineStyle(Math.max(1, bounds.height * 0.009), this.state.active ? UI_TOKENS.color.gold : 0xb6a77f, this.state.active ? 1 : 0.72)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);

    const previewX = bounds.x + bounds.width * 0.08;
    const previewY = bounds.y + bounds.height * 0.10;
    const previewW = bounds.width * 0.84;
    const previewH = bounds.height * 0.48;
    this.preview.clear()
      .fillStyle(color(this.state.boardSurface), 1)
      .fillRoundedRect(previewX, previewY, previewW, previewH, Math.max(5, radius * 0.65))
      .lineStyle(Math.max(1, bounds.height * 0.008), color(this.state.slotEdge), 0.85);
    for (let i = 0; i < 3; i += 1) {
      const slotW = previewW * 0.16;
      const slotH = previewH * 0.42;
      const sx = previewX + previewW * (0.08 + i * 0.22);
      const sy = previewY + previewH * 0.12;
      this.preview.strokeRoundedRect(sx, sy, slotW, slotH, Math.max(2, slotW * 0.08));
    }
    const backW = previewW * 0.20;
    const backH = previewH * 0.72;
    const backX = previewX + previewW * 0.70;
    const backY = previewY + previewH * 0.14;
    this.preview.fillStyle(color(this.state.slotHighlight), 0.46).fillRoundedRect(backX, backY, backW, backH, Math.max(3, backW * 0.09));
    this.preview.lineStyle(Math.max(1, bounds.height * 0.008), color(this.state.slotHighlight), 1)
      .strokeRoundedRect(backX, backY, backW, backH, Math.max(3, backW * 0.09));

    const titleSize = Math.max(13, Math.min(24, bounds.height * 0.095));
    this.title.setFontSize(titleSize).setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.68);
    this.status.setFontSize(Math.max(10, titleSize * 0.55)).setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.80);
    this.action.setFontSize(Math.max(11, titleSize * 0.62)).setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.91);
    this.zone.setPosition(bounds.x, bounds.y).setSize(bounds.width, bounds.height);
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private syncText(): void {
    this.title.setText(this.state.displayName);
    this.status.setText(this.state.active ? tr(this.language, 'themes.active') : this.state.owned ? tr(this.language, 'themes.owned') : tr(this.language, 'themes.locked'));
    this.action.setText(
      this.state.action === 'apply' ? tr(this.language, 'themes.apply')
        : this.state.action === 'buy' ? `● ${this.state.priceCoins}`
          : '',
    ).setVisible(this.state.action !== 'none');
  }
}
