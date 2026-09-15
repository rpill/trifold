import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export class ModalShell {
  private readonly dimmer: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly close: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly onClose: () => void;

  constructor(scene: Phaser.Scene, title: string, onClose: () => void, depth = 5000) {
    this.onClose = onClose;
    this.dimmer = scene.add.rectangle(0, 0, 1, 1, UI_TOKENS.color.overlay, 0.72)
      .setOrigin(0)
      .setDepth(depth)
      .setInteractive();
    this.panel = scene.add.graphics().setDepth(depth + 1);
    this.title = scene.add.text(0, 0, title, {
      color: '#24302e',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.close = scene.add.text(0, 0, '×', {
      color: '#24302e',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.closeZone = scene.add.zone(0, 0, 1, 1).setOrigin(0.5).setDepth(depth + 3).setInteractive();
    this.closeZone.on('pointerdown', () => this.onClose());
  }

  layout(viewportWidth: number, viewportHeight: number, bounds: UiRect): void {
    this.dimmer.setSize(viewportWidth, viewportHeight);
    this.panel.clear();
    this.panel.fillStyle(UI_TOKENS.color.paper, 1).fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      UI_TOKENS.radius.panel,
    );
    this.panel.lineStyle(UI_TOKENS.stroke.normal, UI_TOKENS.color.gold, 0.8)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, UI_TOKENS.radius.panel);
    const headerHeight = Math.max(44, bounds.height * 0.13);
    this.title.setFontSize(Math.max(18, Math.round(headerHeight * 0.35)))
      .setPosition(bounds.x + bounds.width / 2, bounds.y + headerHeight / 2);
    const closeSize = Math.max(44, headerHeight * 0.72);
    this.close.setFontSize(Math.max(22, Math.round(closeSize * 0.48)))
      .setPosition(bounds.x + bounds.width - closeSize * 0.55, bounds.y + headerHeight / 2);
    this.closeZone.setPosition(this.close.x, this.close.y).setSize(closeSize, closeSize);
  }

  setVisible(visible: boolean): void {
    this.dimmer.setVisible(visible).setActive(visible);
    this.panel.setVisible(visible);
    this.title.setVisible(visible);
    this.close.setVisible(visible);
    this.closeZone.setVisible(visible).setActive(visible);
  }

  destroy(): void {
    this.dimmer.destroy();
    this.panel.destroy();
    this.title.destroy();
    this.close.destroy();
    this.closeZone.destroy();
  }
}
