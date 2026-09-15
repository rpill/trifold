import Phaser from 'phaser';
import type { UiRect } from '../layout/HomeLayout.ts';
import type { ResolvedUiViewport } from '../layout/UiViewport.ts';
import { normalizeTouchTarget } from '../layout/UiViewport.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly enabled?: boolean;
}

interface SegmentView<T extends string> {
  readonly option: SegmentOption<T>;
  readonly surface: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
}

export class SegmentedControl<T extends string> {
  readonly enabled = true;
  private readonly views: readonly SegmentView<T>[];
  private readonly onSelect: (value: T) => void;
  private viewport: ResolvedUiViewport;
  private selected: T;

  constructor(
    scene: Phaser.Scene,
    viewport: ResolvedUiViewport,
    options: readonly SegmentOption<T>[],
    selected: T,
    onSelect: (value: T) => void,
    depth = 0,
  ) {
    this.viewport = viewport;
    this.selected = selected;
    this.onSelect = onSelect;
    this.views = options.map((option) => {
      const surface = scene.add.graphics().setDepth(depth);
      const label = scene.add.text(0, 0, option.label, {
        color: '#24302e',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(depth + 0.1);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
      zone.on('pointerdown', () => {
        if (this.enabled && option.enabled !== false) this.onSelect(option.value);
      });
      return { option, surface, label, zone };
    });
  }

  setSelected(value: T): void {
    this.selected = value;
  }

  setViewport(viewport: ResolvedUiViewport): void {
    this.viewport = viewport;
  }

  layout(bounds: UiRect): void {
    const count = Math.max(1, this.views.length);
    const width = bounds.width / count;
    const hitHeight = normalizeTouchTarget(bounds.height, this.viewport);
    for (let index = 0; index < this.views.length; index += 1) {
      const view = this.views[index]!;
      const x = bounds.x + width * index;
      const selected = view.option.value === this.selected;
      const optionEnabled = view.option.enabled !== false;
      const alpha = optionEnabled ? 1 : 0.4;
      view.surface.clear();
      view.surface.fillStyle(selected ? UI_TOKENS.color.paperPressed : UI_TOKENS.color.paper, alpha)
        .fillRoundedRect(x, bounds.y, width, bounds.height, UI_TOKENS.radius.control);
      view.surface.lineStyle(UI_TOKENS.stroke.thin, UI_TOKENS.color.gold, 0.6 * alpha)
        .strokeRoundedRect(x, bounds.y, width, bounds.height, UI_TOKENS.radius.control);
      view.label.setAlpha(alpha).setFontSize(Math.max(11, Math.round(bounds.height * 0.28)))
        .setPosition(x + width / 2, bounds.y + bounds.height / 2);
      view.zone.setPosition(x, bounds.y - (hitHeight - bounds.height) / 2).setSize(width, hitHeight);
    }
  }

  destroy(): void {
    for (const view of this.views) {
      view.surface.destroy();
      view.label.destroy();
      view.zone.destroy();
    }
  }
}
