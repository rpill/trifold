export type CardMotionKind = 'deal' | 'foundation' | 'player' | 'undo';

const CARD_MOTION_DURATION: Record<CardMotionKind, number> = {
  deal: 260,
  foundation: 350,
  player: 110,
  undo: 110,
};

export const DEAL_STAGGER_MS = 52;
const FOUNDATION_STEP_DELAY = 370;
const FOUNDATION_STREAM_INTERVAL = 150;

export function getCardMotionDuration(kind: CardMotionKind): number {
  return CARD_MOTION_DURATION[kind];
}

export function getFoundationStepDelay(): number {
  return FOUNDATION_STEP_DELAY;
}

export function getFoundationStreamInterval(): number {
  return FOUNDATION_STREAM_INTERVAL;
}

export function getDealFlightOriginY(
  dealY: number,
  layerOffsets: readonly number[],
): number {
  return dealY + (layerOffsets[layerOffsets.length - 1] ?? 0);
}
