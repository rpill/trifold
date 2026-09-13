import Phaser from 'phaser';
import { getCard } from '../model/TrifoldRules.ts';
import type { CardId } from '../model/types.ts';

function displayCode(cardId: CardId): string {
  const card = getCard(cardId);
  if (card.kind === 'number') {
    const prefix = card.suit === 'coins' ? 'R' : card.suit === 'bamboo' ? 'G' : 'B';
    return `${prefix}${card.rank}`;
  }
  if (card.kind === 'dragon') {
    const prefix = card.family === 'red' ? 'R' : card.family === 'green' ? 'G' : 'W';
    return `${prefix}D`;
  }
  return 'F';
}

export class SchematicCardView {
  readonly cardId: CardId;
  readonly input: Phaser.GameObjects.Zone;
  private readonly scene: Phaser.Scene;
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly debugLabel: Phaser.GameObjects.Text;
  private width: number;
  private height: number;
  private x = 0;
  private y = 0;
  private depth = 0;

  constructor(scene: Phaser.Scene, cardId: CardId, width: number, height: number) {
    this.scene = scene;
    this.cardId = cardId;
    this.width = width;
    this.height = height;
    this.surface = scene.add.graphics();
    this.label = scene.add.text(0, 0, displayCode(cardId), {
      color: '#17211d',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.debugLabel = scene.add.text(0, 0, import.meta.env.DEV ? cardId : '', {
      color: '#56645d',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    // Keep input geometry independent from the schematic rendering. Phaser Containers
    // use a special transform origin for input; Cascade cards use a top-left-aligned
    // interactive object, so the Zone mirrors that contract exactly.
    this.input = scene.add.zone(0, 0, width, height).setOrigin(0);
    this.relayout(width, height);
  }

  relayout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const radius = Math.max(3, Math.round(Math.min(width, height) * 0.06));
    this.surface.clear();
    this.surface.fillStyle(0xf2f0e8, 1);
    this.surface.fillRoundedRect(0, 0, width, height, radius);
    this.surface.lineStyle(Math.max(1, width * 0.02), 0x26362f, 1);
    this.surface.strokeRoundedRect(0, 0, width, height, radius);

    this.label.setFontSize(Math.max(12, Math.round(width * 0.28)));
    this.debugLabel.setFontSize(Math.max(7, Math.round(width * 0.085)));

    this.input
      .setSize(width, height)
      .setOrigin(0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );
    this.scene.input.setDraggable(this.input);
    this.setPosition(this.x, this.y);
    this.setDepth(this.depth);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.input.setPosition(x, y);
    this.surface.setPosition(x, y);
    this.label.setPosition(x + this.width / 2, y + this.height * 0.44);
    this.debugLabel.setPosition(x + this.width / 2, y + this.height * 0.78);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.surface.setDepth(depth);
    this.label.setDepth(depth + 0.1);
    this.debugLabel.setDepth(depth + 0.1);
    this.input.setDepth(depth + 0.5);
  }

  setVisible(visible: boolean): void {
    this.surface.setVisible(visible);
    this.label.setVisible(visible);
    this.debugLabel.setVisible(visible);
    this.input.setVisible(visible).setActive(visible);
  }

  destroy(): void {
    this.input.destroy();
    this.surface.destroy();
    this.label.destroy();
    this.debugLabel.destroy();
  }
}
