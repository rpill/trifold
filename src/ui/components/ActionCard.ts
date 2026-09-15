import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { normalizeTouchTarget } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { ProgressMeter, type ProgressValue } from './ProgressMeter.ts';

export interface ActionCardState {
  readonly title: string;
  readonly subtitle?: string;
  readonly emphasis?: 'normal' | 'highlight';
  readonly enabled: boolean;
  readonly progress?: ProgressValue;
}

export class ActionCard {
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly progress: ProgressMeter;
  private readonly onPress: () => void;
  private state: ActionCardState;
  private viewport: ResolvedUiViewport;
  private visible = true;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    state: ActionCardState,
    onPress: () => void,
    depth = 0,
  ) {
    this.viewport = viewport;
    this.state = state;
    this.onPress = onPress;
    this.surface = scene.add.graphics().setDepth(depth);
    this.title = scene.add.text(0, 0, state.title, {
      color: '#24302e',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    this.subtitle = scene.add.text(0, 0, state.subtitle ?? '', {
      color: '#64706a',
      fontFamily: 'system-ui, sans-serif',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    this.zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    this.zone.on('pointerdown', () => {
      if (this.state.enabled) this.onPress();
    });
    this.progress = new ProgressMeter(scene, depth + 0.1);
  }

  setState(state: ActionCardState): void {
    this.state = state;
    this.title.setText(state.title);
    this.subtitle.setText(state.subtitle ?? '');
    if (state.progress) this.progress.setProgress(state.progress);
  }

  setViewport(viewport: ResolvedUiViewport): void {
    this.viewport = viewport;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.surface.setVisible(visible);
    this.title.setVisible(visible);
    this.subtitle.setVisible(visible && Boolean(this.state.subtitle));
    this.zone.setVisible(visible).setActive(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    this.progress.setVisible(visible && Boolean(this.state.progress));
  }

  layout(bounds: UiRect): void {
    const fill = this.state.emphasis === 'highlight' ? UI_TOKENS.color.paperPressed : UI_TOKENS.color.paper;
    const alpha = this.state.enabled ? 1 : 0.55;
    const hitHeight = normalizeTouchTarget(bounds.height, this.viewport);
    const hitY = bounds.y - (hitHeight - bounds.height) / 2;
    const titleSize = Math.max(16, Math.round(Math.min(bounds.height * 0.24, 30 * this.viewport.uiScale)));
    const subtitleSize = Math.max(11, Math.round(titleSize * 0.48));

    this.surface.clear();
    this.surface.fillStyle(fill, alpha).fillRoundedRect(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      UI_TOKENS.radius.card,
    );
    this.surface.lineStyle(UI_TOKENS.stroke.normal, UI_TOKENS.color.gold, this.state.enabled ? 0.75 : 0.35)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, UI_TOKENS.radius.card);

    const hasSubtitle = Boolean(this.state.subtitle);
    this.title.setFontSize(titleSize).setAlpha(alpha).setPosition(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height * (hasSubtitle ? 0.40 : 0.50),
    );
    this.subtitle.setFontSize(subtitleSize).setAlpha(alpha).setVisible(this.visible && hasSubtitle).setPosition(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height * 0.64,
    );
    this.zone.setPosition(bounds.x, hitY).setSize(bounds.width, hitHeight);

    const progress = this.state.progress;
    this.progress.setVisible(this.visible && Boolean(progress));
    if (progress) {
      this.progress.setProgress(progress);
      this.progress.layout({
        x: bounds.x + bounds.width * 0.10,
        y: bounds.y + bounds.height * 0.80,
        width: bounds.width * 0.80,
        height: Math.max(5, bounds.height * 0.055),
      });
    }
  }

  destroy(): void {
    this.surface.destroy();
    this.title.destroy();
    this.subtitle.destroy();
    this.zone.destroy();
    this.progress.destroy();
  }
}
