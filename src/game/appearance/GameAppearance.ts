import type { CardBackStyle } from './CardBackStyle.ts';

export interface TrifoldAppearance {
  readonly boardSurfaceColor: number;
  readonly slotPalette: {
    readonly recess: number;
    readonly edge: number;
    readonly highlight: number;
  };
  readonly cardBackStyle: CardBackStyle;
}

export const TRIFOLD_APPEARANCE: TrifoldAppearance = Object.freeze({
  boardSurfaceColor: 0x183f2f,
  slotPalette: Object.freeze({
    recess: 0x173a2d,
    edge: 0x8aa095,
    highlight: 0xd7b84d,
  }),
  cardBackStyle: Object.freeze({
    paper: 0xe8e2cf,
    edge: 0x8aa095,
    innerEdge: 0xd7b84d,
    patternA: 0x173a2d,
    patternB: 0xeef1ea,
  }),
});
