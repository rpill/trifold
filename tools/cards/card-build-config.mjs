const FRAME = 'assets-src/cards/frame/face.png';
const OUTPUT_DIR = 'public/assets/cards/generated';

export const CARD_RUNTIME_VARIANTS = Object.freeze([
  Object.freeze({ density: 1, directory: '1x', width: 128, height: 200 }),
  Object.freeze({ density: 2, directory: '2x', width: 256, height: 399 }),
]);

export const DRAGON_CARD_BUILD = Object.freeze({
  frame: FRAME,
  outputDir: OUTPUT_DIR,
  colors: Object.freeze(['red', 'green', 'blue']),
  center: Object.freeze({
    x: 135,
    y: 170,
    width: 598,
    height: 980,
  }),
  topLeftCorner: Object.freeze({
    x: 62,
    y: 58,
    width: 108,
    height: 130,
    rotate180: false,
  }),
  bottomRightCorner: Object.freeze({
    x: 698,
    y: 1165,
    width: 108,
    height: 130,
    rotate180: true,
  }),
});

export const FLOWER_CARD_BUILD = Object.freeze({
  frame: FRAME,
  outputDir: OUTPUT_DIR,
  center: Object.freeze({
    x: 128,
    y: 176,
    width: 612,
    height: 964,
  }),
  topLeftCorner: Object.freeze({
    x: 60,
    y: 58,
    width: 112,
    height: 112,
    rotate180: false,
  }),
  bottomRightCorner: Object.freeze({
    x: 696,
    y: 1178,
    width: 112,
    height: 112,
    rotate180: true,
  }),
});

export const NUMBER_CARD_BUILD = Object.freeze({
  frame: FRAME,
  outputDir: OUTPUT_DIR,
  ranks: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  suits: Object.freeze({
    coins: Object.freeze({ color: Object.freeze([194, 75, 43]) }),
    bamboo: Object.freeze({ color: Object.freeze([31, 138, 91]) }),
    characters: Object.freeze({ color: Object.freeze([48, 91, 140]) }),
  }),
  topLeftRank: Object.freeze({
    x: 66,
    y: 58,
    width: 116,
    height: 150,
    rotate180: false,
  }),
  topLeftSuit: Object.freeze({
    x: 172,
    y: 76,
    width: 82,
    height: 82,
    rotate180: false,
  }),
  centerRank: Object.freeze({
    x: 226,
    y: 390,
    width: 416,
    height: 510,
    rotate180: false,
  }),
  centerSuit: Object.freeze({
    x: 352,
    y: 868,
    width: 164,
    height: 164,
    rotate180: false,
  }),
  bottomRightRank: Object.freeze({
    x: 686,
    y: 1126,
    width: 116,
    height: 150,
    rotate180: false,
  }),
  bottomRightSuit: Object.freeze({
    x: 612,
    y: 1184,
    width: 72,
    height: 72,
    rotate180: false,
  }),
});
