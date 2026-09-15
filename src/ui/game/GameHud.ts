import Phaser from 'phaser';
import type { LayoutBounds, ViewportLayout } from '../../game/view/ViewportLayout.ts';
import { UI_ICON_KEYS } from '../assets/UiAssets.ts';
import { UI_TOKENS } from '../style/UiTokens.ts';
import { calculateGameHudLayout } from './GameHudLayout.ts';
import type { GameHudViewModel } from './GameHudViewModel.ts';

export interface GameHudActions {
  readonly home: () => void;
  readonly newDeal: () => void;
  readonly undo: () => void;
  readonly hint: () => void;
  readonly settings: () => void;
}

interface HudButton {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly icon: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly action: () => void;
  readonly iconOnly: boolean;
  text: string;
  enabled: boolean;
}

export class GameHud {
  private readonly buttons: Readonly<Record<'home' | 'newDeal' | 'undo' | 'hint' | 'settings', HudButton>>;
  private readonly metricsSurface: Phaser.GameObjects.Graphics;
  private readonly difficultyText: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly coinsIcon: Phaser.GameObjects.Image;
  private readonly coinsText: Phaser.GameObjects.Text;
  private readonly assistedText: Phaser.GameObjects.Text;
  private viewModel: GameHudViewModel;
  private currentLayout: ViewportLayout | null = null;

  constructor(
    scene: Phaser.Scene,
    viewModel: GameHudViewModel,
    actions: GameHudActions,
    depth = 2000,
  ) {
    this.viewModel = viewModel;
    this.buttons = {
      home: this.createButton(scene, viewModel.homeLabel, UI_ICON_KEYS.home, true, actions.home, depth),
      newDeal: this.createButton(scene, viewModel.newDealLabel, UI_ICON_KEYS.newDeal, true, actions.newDeal, depth),
      undo: this.createButton(scene, viewModel.undoLabel, UI_ICON_KEYS.undo, viewModel.undoEnabled, actions.undo, depth),
      hint: this.createButton(scene, viewModel.hintLabel, UI_ICON_KEYS.hint, viewModel.hintEnabled, actions.hint, depth),
      settings: this.createButton(scene, '', UI_ICON_KEYS.settings, true, actions.settings, depth, true),
    };
    this.metricsSurface = scene.add.graphics().setDepth(depth);
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: '#f0e6d3',
      fontFamily: 'system-ui, sans-serif',
      align: 'center',
    };
    this.difficultyText = scene.add.text(0, 0, '', { ...textStyle, fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 0.1);
    this.movesText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.timeText = scene.add.text(0, 0, '', textStyle).setOrigin(0.5).setDepth(depth + 0.1);
    this.coinsIcon = scene.add.image(0, 0, UI_ICON_KEYS.coin)
      .setOrigin(0.5)
      .setTint(UI_TOKENS.color.goldLight)
      .setDepth(depth + 0.1);
    this.coinsText = scene.add.text(0, 0, '', textStyle).setOrigin(0, 0.5).setDepth(depth + 0.1);
    this.assistedText = scene.add.text(0, 0, '', {
      ...textStyle,
      color: '#d8bc82',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    this.syncText();
  }

  setState(viewModel: GameHudViewModel): void {
    this.viewModel = viewModel;
    this.buttons.home.text = viewModel.homeLabel;
    this.buttons.newDeal.text = viewModel.newDealLabel;
    this.buttons.undo.text = viewModel.undoLabel;
    this.buttons.hint.text = viewModel.hintLabel;
    this.buttons.home.label.setText(viewModel.homeLabel);
    this.buttons.newDeal.label.setText(viewModel.newDealLabel);
    this.buttons.undo.label.setText(viewModel.undoLabel);
    this.buttons.hint.label.setText(viewModel.hintLabel);
    this.buttons.undo.enabled = viewModel.undoEnabled;
    this.buttons.hint.enabled = viewModel.hintEnabled;
    this.syncText();
    if (this.currentLayout) this.layout(this.currentLayout);
  }

  layout(viewport: ViewportLayout): void {
    this.currentLayout = viewport;
    const hud = calculateGameHudLayout(viewport);
    this.layoutButton(this.buttons.home, hud.home);
    this.layoutButton(this.buttons.newDeal, hud.newDeal);
    this.layoutButton(this.buttons.undo, hud.undo);
    this.layoutButton(this.buttons.hint, hud.hint);
    this.layoutButton(this.buttons.settings, hud.settings);
    this.layoutMetrics(hud.metrics);
  }

  destroy(): void {
    for (const button of Object.values(this.buttons)) {
      button.graphics.destroy();
      button.icon.destroy();
      button.label.destroy();
      button.zone.destroy();
    }
    this.metricsSurface.destroy();
    this.difficultyText.destroy();
    this.movesText.destroy();
    this.timeText.destroy();
    this.coinsIcon.destroy();
    this.coinsText.destroy();
    this.assistedText.destroy();
  }

  private createButton(
    scene: Phaser.Scene,
    text: string,
    iconKey: string,
    enabled: boolean,
    action: () => void,
    depth: number,
    iconOnly = false,
  ): HudButton {
    const graphics = scene.add.graphics().setDepth(depth);
    const icon = scene.add.image(0, 0, iconKey)
      .setOrigin(0.5)
      .setTint(UI_TOKENS.color.paper)
      .setDepth(depth + 0.1);
    const label = scene.add.text(0, 0, text, {
      color: '#f0e6d3',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 0.1);
    const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(depth + 0.2).setInteractive();
    const button: HudButton = { graphics, icon, label, zone, action, text, enabled, iconOnly };
    zone.on('pointerdown', () => {
      if (button.enabled) button.action();
    });
    return button;
  }

  private layoutButton(button: HudButton, bounds: LayoutBounds): void {
    const alpha = button.enabled ? 0.98 : 0.34;
    const radius = Math.max(4, Math.min(12, bounds.height * 0.2));
    button.graphics.clear()
      .fillStyle(UI_TOKENS.color.control, alpha)
      .fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius)
      .lineStyle(Math.max(1, bounds.height * 0.025), UI_TOKENS.color.gold, button.enabled ? 0.82 : 0.26)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);

    const iconSize = Math.max(16, Math.min(bounds.height * 0.46, bounds.width * (button.iconOnly ? 0.32 : 0.25)));
    button.icon.setAlpha(button.enabled ? 1 : 0.38).setDisplaySize(iconSize, iconSize);
    button.label.setAlpha(button.enabled ? 1 : 0.38).setVisible(!button.iconOnly);

    if (button.iconOnly) {
      button.icon.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    } else {
      const iconX = bounds.x + Math.max(iconSize * 0.9, bounds.width * 0.22);
      const labelX = bounds.x + bounds.width * 0.62;
      button.icon.setPosition(iconX, bounds.y + bounds.height / 2);
      button.label
        .setFontSize(Math.max(9, Math.min(bounds.height * 0.28, (bounds.width * 0.56) / Math.max(3.4, button.text.length * 0.62))))
        .setPosition(labelX, bounds.y + bounds.height / 2);
    }

    button.zone.setPosition(bounds.x, bounds.y).setSize(bounds.width, bounds.height);
    if (button.enabled) button.zone.setInteractive();
    else button.zone.disableInteractive();
  }

  private layoutMetrics(bounds: LayoutBounds): void {
    this.metricsSurface.clear()
      .fillStyle(UI_TOKENS.color.control, 0.78)
      .fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.width * 0.08))
      .lineStyle(1, UI_TOKENS.color.gold, 0.42)
      .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.width * 0.08));
    const baseSize = Math.max(9, Math.min(16, bounds.width * 0.13));
    const lines = this.viewModel.assisted ? 5 : 4;
    const lineGap = Math.min(baseSize * 1.35, bounds.height / Math.max(1, lines + 0.4));
    const startY = bounds.y + Math.max(lineGap * 0.7, (bounds.height - lineGap * (lines - 1)) / 2);
    const centerX = bounds.x + bounds.width / 2;
    const texts = [this.difficultyText, this.movesText, this.timeText];
    texts.forEach((text, index) => text.setFontSize(baseSize).setPosition(centerX, startY + lineGap * index));

    const coinsY = startY + lineGap * 3;
    const coinSize = Math.max(10, baseSize * 0.82);
    this.coinsIcon.setDisplaySize(coinSize, coinSize).setPosition(centerX - baseSize * 0.5, coinsY);
    this.coinsText.setFontSize(baseSize).setPosition(centerX - baseSize * 0.1, coinsY);

    this.assistedText
      .setVisible(this.viewModel.assisted)
      .setFontSize(Math.max(8, baseSize * 0.8))
      .setPosition(centerX, startY + lineGap * 4);
  }

  private syncText(): void {
    this.difficultyText.setText(this.viewModel.difficultyLabel);
    this.movesText.setText(this.viewModel.movesLabel);
    this.timeText.setText(this.viewModel.timeLabel);
    this.coinsText.setText(String(this.viewModel.coins));
    this.assistedText.setText(this.viewModel.assistedLabel).setVisible(this.viewModel.assisted);
  }
}
