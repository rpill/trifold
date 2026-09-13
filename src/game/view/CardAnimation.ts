export type CardMotionKind = 'deal' | 'foundation' | 'player' | 'undo';

const CARD_MOTION_DURATION: Record<CardMotionKind, number> = {
  deal: 260,
  foundation: 350,
  player: 110,
  undo: 110,
};

export const DEAL_STAGGER_MS = 52;

export function getCardMotionDuration(kind: CardMotionKind): number {
  return CARD_MOTION_DURATION[kind];
}
