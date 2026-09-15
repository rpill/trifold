import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export interface PaperPanelOptions {
  readonly textureKey?: string;
  readonly alpha?: number;
  readonly depth?: number;
}

export class PaperPanel {
  private readonly scene: Phaser.Scene;
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly textureKey: string | undefined;
  private texture: Phaser.GameObjects.Image | null = null;
  private alpha: number;
  private depth: number;

  constructor(scene: Phaser.Scene, options: PaperPanelOptions = {}) {
    this.scene = scene;
    this.textureKey = options.textureKey;
    this.alpha = options.alpha ?? 1;
    this.depth = options.depth ?? 0;
    this.surface = scene.add.graphics().setDepth(this.depth);
  }

  layout(bounds: UiRect): void {
    this.surface.clear();
    if (this.textureKey && this.scene.textures.exists(this.textureKey)) {
      if (!this.texture) {
        this.texture = this.scene.add.image(0, 0, this.textureKey).setOrigin(0).setDepth(this.depth);
      }
      this.texture
        .setPosition(bounds.x, bounds.y)
        .setDisplaySize(bounds.width, bounds.height)
        .setAlpha(this.alpha)
        .setVisible(true);
      return;
    }

    this.texture?.setVisible(false);
    this.surface
      .fillStyle(UI_TOKENS.color.paper, this.alpha)
      .fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, UI_TOKENS.radius.panel)
      .lineStyle(UI_TOKENS.stroke.normal, UI_TOKENS.color.gold, 0.65)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, UI_TOKENS.radius.panel);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.surface.setDepth(depth);
    this.texture?.setDepth(depth);
  }

  setAlpha(alpha: number): void {
    this.alpha = alpha;
    this.surface.setAlpha(alpha);
    this.texture?.setAlpha(alpha);
  }

  destroy(): void {
    this.surface.destroy();
    this.texture?.destroy();
  }
}
