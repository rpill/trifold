import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARD_RUNTIME_VARIANTS,
  DRAGON_CARD_BUILD,
  FLOWER_CARD_BUILD,
  NUMBER_CARD_BUILD,
} from './card-build-config.mjs';
import {
  decodePng,
  encodePng,
  placeContained,
  resizeRgbaArea,
  tintRgba,
} from './png-tools.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const absolute = (path) => resolve(repoRoot, path);

function cloneImage(image) {
  return {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
  };
}

function decodeFrame(path) {
  const frame = decodePng(absolute(path));
  if (frame.width !== 868 || frame.height !== 1353) {
    throw new Error(`Unexpected card frame size ${frame.width}x${frame.height}; expected 868x1353.`);
  }
  return frame;
}

function writeCardOutputs(outputDir, filename, card) {
  mkdirSync(absolute(outputDir), { recursive: true });
  const masterOutput = absolute(`${outputDir}/${filename}`);
  encodePng(masterOutput, card);

  for (const variant of CARD_RUNTIME_VARIANTS) {
    const variantDir = absolute(`${outputDir}/${variant.directory}`);
    mkdirSync(variantDir, { recursive: true });
    const runtimeCard = resizeRgbaArea(card, variant.width, variant.height);
    encodePng(resolve(variantDir, filename), runtimeCard);
  }

  console.log(`[cards] ${filename}: ${card.width}x${card.height} + 1x/2x runtime variants`);
}

function buildDragonCards() {
  const frame = decodeFrame(DRAGON_CARD_BUILD.frame);

  for (const color of DRAGON_CARD_BUILD.colors) {
    const center = decodePng(absolute(`assets-src/cards/dragons/${color}-center.png`));
    const corner = decodePng(absolute(`assets-src/cards/dragons/${color}-corner.png`));
    const card = cloneImage(frame);

    placeContained(card, center, DRAGON_CARD_BUILD.center);
    placeContained(card, corner, DRAGON_CARD_BUILD.topLeftCorner);
    placeContained(card, corner, DRAGON_CARD_BUILD.bottomRightCorner);

    writeCardOutputs(DRAGON_CARD_BUILD.outputDir, `dragon-${color}.png`, card);
  }
}

function buildFlowerCard() {
  const frame = decodeFrame(FLOWER_CARD_BUILD.frame);
  const center = decodePng(absolute('assets-src/cards/flower/center.png'));
  const corner = decodePng(absolute('assets-src/cards/flower/corner.png'));
  const card = cloneImage(frame);

  placeContained(card, center, FLOWER_CARD_BUILD.center);
  placeContained(card, corner, FLOWER_CARD_BUILD.topLeftCorner);
  placeContained(card, corner, FLOWER_CARD_BUILD.bottomRightCorner);

  writeCardOutputs(FLOWER_CARD_BUILD.outputDir, 'flower.png', card);
}

function buildNumberCards() {
  const frame = decodeFrame(NUMBER_CARD_BUILD.frame);

  for (const [suit, spec] of Object.entries(NUMBER_CARD_BUILD.suits)) {
    const suitMask = decodePng(absolute(`assets-src/cards/numbers/suits/${suit}.png`));
    const suitImage = tintRgba(suitMask, spec.color);

    for (const rank of NUMBER_CARD_BUILD.ranks) {
      const rankMask = decodePng(absolute(`assets-src/cards/numbers/ranks/${rank}.png`));
      const rankImage = tintRgba(rankMask, spec.color);
      const card = cloneImage(frame);

      placeContained(card, rankImage, NUMBER_CARD_BUILD.topLeftRank);
      placeContained(card, suitImage, NUMBER_CARD_BUILD.topLeftSuit);
      placeContained(card, rankImage, NUMBER_CARD_BUILD.centerRank);
      placeContained(card, suitImage, NUMBER_CARD_BUILD.centerSuit);
      placeContained(card, rankImage, NUMBER_CARD_BUILD.bottomRightRank);
      placeContained(card, suitImage, NUMBER_CARD_BUILD.bottomRightSuit);

      writeCardOutputs(NUMBER_CARD_BUILD.outputDir, `${suit}-${rank}.png`, card);
    }
  }
}

buildDragonCards();
buildFlowerCard();
buildNumberCards();
