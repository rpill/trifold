import Phaser from 'phaser';
import type { DragonFamily, NumericSuit } from '../model/types.ts';

const GENERATED_CARD_ROOT_1X = '/assets/cards/generated/1x';
const GENERATED_CARD_ROOT_2X = '/assets/cards/generated/2x';

export type CardFaceDensity = 1 | 2;

export const CARD_FACE_KEYS = {
  dragonRed: 'card.face.dragon.red',
  dragonGreen: 'card.face.dragon.green',
  dragonBlue: 'card.face.dragon.blue',
  flower: 'card.face.flower',
} as const;

const CARD_FACE_FILES: Readonly<Record<keyof typeof CARD_FACE_KEYS, string>> = {
  dragonRed: 'dragon-red.png',
  dragonGreen: 'dragon-green.png',
  dragonBlue: 'dragon-blue.png',
  flower: 'flower.png',
};

const NUMERIC_SUITS: readonly NumericSuit[] = ['coins', 'bamboo', 'characters'];
const NUMERIC_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function cardFaceDensityForRenderScale(renderScale: number): CardFaceDensity {
  return Number.isFinite(renderScale) && renderScale > 1.01 ? 2 : 1;
}

export function cardFaceTextureKey(baseKey: string, density: CardFaceDensity): string {
  return `${baseKey}@${density}x`;
}

function generatedRoot(density: CardFaceDensity): string {
  return density === 2 ? GENERATED_CARD_ROOT_2X : GENERATED_CARD_ROOT_1X;
}

export function numericFaceKey(suit: NumericSuit, rank: number): string {
  return `card.face.number.${suit}.${rank}`;
}

export function preloadCardFaceAssets(scene: Phaser.Scene): void {
  for (const density of [1, 2] as const) {
    const root = generatedRoot(density);

    for (const [name, baseKey] of Object.entries(CARD_FACE_KEYS) as [keyof typeof CARD_FACE_KEYS, string][]) {
      const key = cardFaceTextureKey(baseKey, density);
      if (scene.textures.exists(key)) continue;
      scene.load.image(key, `${root}/${CARD_FACE_FILES[name]}`);
    }

    for (const suit of NUMERIC_SUITS) {
      for (const rank of NUMERIC_RANKS) {
        const baseKey = numericFaceKey(suit, rank);
        const key = cardFaceTextureKey(baseKey, density);
        if (scene.textures.exists(key)) continue;
        scene.load.image(key, `${root}/${suit}-${rank}.png`);
      }
    }
  }
}

export function dragonFaceKey(family: DragonFamily): string {
  if (family === 'red') return CARD_FACE_KEYS.dragonRed;
  if (family === 'green') return CARD_FACE_KEYS.dragonGreen;
  // The model keeps the historical `white` identifier so existing verified deals,
  // saves and solver data remain compatible. Visually this family is the blue dragon.
  return CARD_FACE_KEYS.dragonBlue;
}

export function flowerFaceKey(): string {
  return CARD_FACE_KEYS.flower;
}
