import Phaser from 'phaser';
import { getCard } from '../model/TrifoldRules.ts';
import type { CardId, DragonFamily, NumericSuit } from '../model/types.ts';
import type { CardBackStyle } from '../appearance/CardBackStyle.ts';
import {
  cardFaceDensityForRenderScale,
  cardFaceTextureKey,
  dragonFaceKey,
  flowerFaceKey,
  numericFaceKey,
} from './CardFaceAssets.ts';


const DEFAULT_CARD_BACK_STYLE: CardBackStyle = {
  paper: 0xe8e2cf,
  edge: 0x31443b,
  innerEdge: 0x6f8b7e,
  patternA: 0x88a698,
  patternB: 0xeef1ea,
};

interface CardPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly border: number;
}

interface CardFaceSpec {
  readonly topLeftRank: string;
  readonly topLeftKind: string;
  readonly centerLabel: string;
  readonly bottomRightRank: string;
  readonly bottomRightKind: string;
  readonly palette: CardPalette;
}

function suitAbbreviation(suit: NumericSuit): string {
  return suit === 'coins' ? 'CO' : suit === 'bamboo' ? 'BA' : 'CH';
}

function suitPalette(suit: NumericSuit): CardPalette {
  return suit === 'coins'
    ? { primary: '#c34d2b', secondary: '#8a3d27', border: 0x2a3a33 }
    : suit === 'bamboo'
      ? { primary: '#1f8a5b', secondary: '#176a46', border: 0x2a3a33 }
      : { primary: '#305b8c', secondary: '#24466b', border: 0x2a3a33 };
}

function dragonPalette(family: DragonFamily): CardPalette {
  return family === 'red'
    ? { primary: '#bf432c', secondary: '#8f3323', border: 0x2a3a33 }
    : family === 'green'
      ? { primary: '#21835b', secondary: '#186245', border: 0x2a3a33 }
      : { primary: '#51656f', secondary: '#384850', border: 0x2a3a33 };
}

function dragonAbbreviation(family: DragonFamily): string {
  return family === 'red' ? 'RD' : family === 'green' ? 'GD' : 'BD';
}

function faceSpec(cardId: CardId): CardFaceSpec {
  const card = getCard(cardId);
  if (card.kind === 'number') {
    const rank = String(card.rank);
    const kind = suitAbbreviation(card.suit);
    return {
      topLeftRank: rank,
      topLeftKind: kind,
      centerLabel: rank,
      bottomRightRank: rank,
      bottomRightKind: kind,
      palette: suitPalette(card.suit),
    };
  }
  if (card.kind === 'dragon') {
    const code = dragonAbbreviation(card.family);
    return {
      topLeftRank: code,
      topLeftKind: '',
      centerLabel: code,
      bottomRightRank: code,
      bottomRightKind: '',
      palette: dragonPalette(card.family),
    };
  }
  return {
    topLeftRank: 'F',
    topLeftKind: '',
    centerLabel: 'F',
    bottomRightRank: 'F',
    bottomRightKind: '',
    palette: { primary: '#8053a6', secondary: '#5b3b77', border: 0x2a3a33 },
  };
}

export function drawSchematicCardBack(
  surface: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  edgeOnly = false,
  style: CardBackStyle = DEFAULT_CARD_BACK_STYLE,
): void {
  const radius = Math.max(3, Math.round(Math.min(width, height) * 0.06));
  const border = Math.max(1, width * 0.02);
  const outerInset = Math.max(4, width * 0.06);
  const innerInset = outerInset + Math.max(3, width * 0.045);
  const patternCell = Math.max(4, Math.round(width * 0.075));

  surface.fillStyle(edgeOnly ? 0xe2dbc7 : style.paper, 1);
  surface.fillRoundedRect(x, y, width, height, radius);
  surface.lineStyle(border, edgeOnly ? 0x7f7a6f : style.edge, 1);
  surface.strokeRoundedRect(x, y, width, height, radius);

  if (edgeOnly) {
    surface.lineStyle(Math.max(1, border * 0.75), 0xbbb4a0, 1);
    surface.strokeRoundedRect(
      x + outerInset * 0.55,
      y + outerInset * 0.55,
      width - outerInset * 1.1,
      height - outerInset * 1.1,
      Math.max(2, radius * 0.5),
    );
    return;
  }

  surface.lineStyle(Math.max(1, border * 0.75), style.innerEdge, 1);
  surface.strokeRoundedRect(
    x + outerInset,
    y + outerInset,
    width - outerInset * 2,
    height - outerInset * 2,
    Math.max(2, radius * 0.55),
  );
  const patternWidth = width - innerInset * 2;
  const patternHeight = height - innerInset * 2;
  const columns = Math.max(3, Math.floor(patternWidth / patternCell));
  const rows = Math.max(4, Math.floor(patternHeight / patternCell));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      surface.fillStyle((row + column) % 2 === 0 ? style.patternA : style.patternB, 1);
      surface.fillRect(
        x + innerInset + column * patternCell,
        y + innerInset + row * patternCell,
        patternCell,
        patternCell,
      );
    }
  }
  surface.lineStyle(Math.max(1, border * 0.55), style.innerEdge, 1);
  surface.strokeRect(x + innerInset, y + innerInset, columns * patternCell, rows * patternCell);
}

export class SchematicCardView {
  readonly cardId: CardId;
  readonly input: Phaser.GameObjects.Zone;
  private readonly scene: Phaser.Scene;
  private readonly surface: Phaser.GameObjects.Graphics;
  private readonly faceImage: Phaser.GameObjects.Image | null;
  private readonly faceBaseKey: string | null;
  private readonly topLeftRank: Phaser.GameObjects.Text;
  private readonly topLeftKind: Phaser.GameObjects.Text;
  private readonly centerLabel: Phaser.GameObjects.Text;
  private readonly bottomRightRank: Phaser.GameObjects.Text;
  private readonly bottomRightKind: Phaser.GameObjects.Text;
  private readonly palette: CardPalette;
  private readonly hasCustomFace: boolean;
  private width: number;
  private height: number;
  private x = 0;
  private y = 0;
  private depth = 0;
  private faceDown = false;
  private visible = true;
  private cardBackStyle: CardBackStyle;

  constructor(scene: Phaser.Scene, cardId: CardId, width: number, height: number, cardBackStyle: CardBackStyle = DEFAULT_CARD_BACK_STYLE) {
    this.scene = scene;
    this.cardId = cardId;
    this.width = width;
    this.height = height;
    this.cardBackStyle = cardBackStyle;
    const spec = faceSpec(cardId);
    this.palette = spec.palette;
    this.surface = scene.add.graphics();
    const card = getCard(cardId);
    this.faceBaseKey = card.kind === 'dragon'
      ? dragonFaceKey(card.family)
      : card.kind === 'flower'
        ? flowerFaceKey()
        : card.kind === 'number'
          ? numericFaceKey(card.suit, card.rank)
          : null;
    const initialRenderScale = this.currentRenderScale();
    this.faceImage = this.faceBaseKey === null
      ? null
      : scene.add.image(
        0,
        0,
        cardFaceTextureKey(this.faceBaseKey, cardFaceDensityForRenderScale(initialRenderScale)),
      ).setOrigin(0);
    this.hasCustomFace = this.faceImage !== null;
    this.topLeftRank = scene.add.text(0, 0, spec.topLeftRank, {
      color: spec.palette.primary,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'left',
    }).setOrigin(0, 0.5);
    this.topLeftKind = scene.add.text(0, 0, spec.topLeftKind, {
      color: spec.palette.secondary,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'left',
    }).setOrigin(0, 0.5);
    this.centerLabel = scene.add.text(0, 0, spec.centerLabel, {
      color: spec.palette.primary,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.bottomRightRank = scene.add.text(0, 0, spec.bottomRightRank, {
      color: spec.palette.primary,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'right',
    }).setOrigin(1, 0.5);
    this.bottomRightKind = scene.add.text(0, 0, spec.bottomRightKind, {
      color: spec.palette.secondary,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'right',
    }).setOrigin(1, 0.5);

    this.input = scene.add.zone(0, 0, width, height).setOrigin(0);
    this.relayout(width, height);
  }

  relayout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.input
      .setSize(width, height)
      .setOrigin(0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );
    this.scene.input.setDraggable(this.input);
    this.topLeftRank.setFontSize(Math.max(10, Math.round(width * 0.17)));
    this.topLeftKind.setFontSize(Math.max(0, Math.round(width * 0.075)));
    this.centerLabel.setFontSize(Math.max(18, Math.round(width * 0.34)));
    this.bottomRightRank.setFontSize(Math.max(9, Math.round(width * 0.12)));
    this.bottomRightKind.setFontSize(Math.max(0, Math.round(width * 0.07)));
    if (this.faceImage && this.faceBaseKey) {
      const density = cardFaceDensityForRenderScale(this.currentRenderScale());
      this.faceImage
        .setTexture(cardFaceTextureKey(this.faceBaseKey, density))
        .setDisplaySize(width, height);
    }
    this.renderSurface();
    this.setPosition(this.x, this.y);
    this.setDepth(this.depth);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.input.setPosition(x, y);
    this.surface.setPosition(x, y);
    this.faceImage?.setPosition(x, y);
    this.topLeftRank.setPosition(x + this.width * 0.08, y + this.height * 0.11);
    this.topLeftKind.setPosition(x + this.width * 0.24, y + this.height * 0.11);
    this.centerLabel.setPosition(x + this.width / 2, y + this.height * 0.50);
    this.bottomRightKind.setPosition(x + this.width * 0.90, y + this.height * 0.87);
    this.bottomRightRank.setPosition(x + this.width * 0.74, y + this.height * 0.87);
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.surface.setDepth(depth);
    this.faceImage?.setDepth(depth);
    this.topLeftRank.setDepth(depth + 0.1);
    this.topLeftKind.setDepth(depth + 0.1);
    this.centerLabel.setDepth(depth + 0.1);
    this.bottomRightRank.setDepth(depth + 0.1);
    this.bottomRightKind.setDepth(depth + 0.1);
    this.input.setDepth(depth + 0.5);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.applyVisibility();
  }

  setCardBackStyle(style: CardBackStyle): void {
    this.cardBackStyle = style;
    if (this.faceDown) this.renderSurface();
  }

  setFaceDown(faceDown: boolean): void {
    if (this.faceDown === faceDown) return;
    this.faceDown = faceDown;
    this.renderSurface();
    this.applyVisibility();
  }

  private currentRenderScale(): number {
    const zoom = this.scene.scale.zoom;
    return zoom > 0 ? 1 / zoom : 1;
  }

  private faceTexts(): readonly Phaser.GameObjects.Text[] {
    return [
      this.topLeftRank,
      this.topLeftKind,
      this.centerLabel,
      this.bottomRightRank,
      this.bottomRightKind,
    ];
  }

  private renderSurface(): void {
    const width = this.width;
    const height = this.height;
    const radius = Math.max(3, Math.round(Math.min(width, height) * 0.06));
    this.surface.clear();

    if (this.faceDown) {
      drawSchematicCardBack(this.surface, 0, 0, width, height, false, this.cardBackStyle);
      this.applyVisibility();
      return;
    }

    if (this.hasCustomFace) {
      this.applyVisibility();
      return;
    }

    this.surface.fillStyle(0xf2f0e8, 1);
    this.surface.fillRoundedRect(0, 0, width, height, radius);
    this.surface.lineStyle(Math.max(1, width * 0.02), this.palette.border, 1);
    this.surface.strokeRoundedRect(0, 0, width, height, radius);
    this.surface.lineStyle(Math.max(1, width * 0.012), 0xd4cdbd, 1);
    this.surface.strokeRoundedRect(
      Math.max(2, width * 0.02),
      Math.max(2, width * 0.02),
      width - Math.max(4, width * 0.04),
      height - Math.max(4, width * 0.04),
      Math.max(2, radius * 0.65),
    );
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const showCustomFace = this.visible && !this.faceDown && this.hasCustomFace;
    const showSurface = this.visible && (this.faceDown || !this.hasCustomFace);
    const showText = this.visible && !this.faceDown && !this.hasCustomFace;

    this.surface.setVisible(showSurface);
    this.faceImage?.setVisible(showCustomFace);
    for (const faceText of this.faceTexts()) faceText.setVisible(showText);
    this.input.setVisible(this.visible).setActive(this.visible);
  }

  destroy(): void {
    this.input.destroy();
    this.surface.destroy();
    this.faceImage?.destroy();
    this.topLeftRank.destroy();
    this.topLeftKind.destroy();
    this.centerLabel.destroy();
    this.bottomRightRank.destroy();
    this.bottomRightKind.destroy();
  }
}
