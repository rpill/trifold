// Production card frame v2: 868 x 1353.
// Keep every face, slot and card back on this single geometry.
export const CARD_ASPECT_RATIO = 1353 / 868;
export const COMPACT_MIN_CARD_WIDTH = 50;
export const STANDARD_MIN_CARD_WIDTH = 84;
export const MAX_CARD_WIDTH = 180;

const COMPACT_MAX_HEIGHT = 620;
const COMPACT_MAX_WIDTH = 1000;

export type LayoutProfile = 'standard' | 'compact-landscape';

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface LayoutPoint {
  readonly x: number;
  readonly y: number;
}

export interface LayoutBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportLayout {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly profile: LayoutProfile;
  readonly safeArea: SafeAreaInsets;
  readonly boardBounds: LayoutBounds;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly tableauX: readonly number[];
  readonly tableauY: number;
  readonly tableauCardGap: number;
  readonly freeCells: readonly LayoutPoint[];
  readonly flowerFoundation: LayoutPoint;
  readonly foundations: readonly LayoutPoint[];
  readonly dragonControls: readonly LayoutBounds[];
  readonly homeControl: LayoutBounds;
  readonly newDealControl: LayoutBounds;
  readonly undoControl: LayoutBounds;
  readonly dealOrigin: LayoutPoint;
  readonly bottomMargin: number;
}

export const ZERO_SAFE_AREA: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function clamp(minimum: number, value: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function normalizeInset(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateViewportLayout(
  viewportWidth: number,
  viewportHeight: number,
  safeArea: SafeAreaInsets = ZERO_SAFE_AREA,
): ViewportLayout {
  const width = normalizeDimension(viewportWidth);
  const height = normalizeDimension(viewportHeight);
  const insets: SafeAreaInsets = {
    top: normalizeInset(safeArea.top),
    right: normalizeInset(safeArea.right),
    bottom: normalizeInset(safeArea.bottom),
    left: normalizeInset(safeArea.left),
  };
  const safeWidth = Math.max(1, width - insets.left - insets.right);
  const safeHeight = Math.max(1, height - insets.top - insets.bottom);
  const profile: LayoutProfile = safeHeight <= COMPACT_MAX_HEIGHT && safeWidth <= COMPACT_MAX_WIDTH
    ? 'compact-landscape'
    : 'standard';
  const compact = profile === 'compact-landscape';

  const edgeMargin = clamp(compact ? 6 : 14, safeWidth * (compact ? 0.01 : 0.015), compact ? 10 : 24);
  const railGap = compact ? 6 : 12;
  const controlRailWidth = clamp(compact ? 86 : 116, safeWidth * (compact ? 0.105 : 0.105), compact ? 102 : 144);
  const boardX = insets.left + edgeMargin;
  const boardY = insets.top + edgeMargin;
  const boardRight = width - insets.right - edgeMargin - controlRailWidth - railGap;
  const boardBottom = height - insets.bottom - edgeMargin;
  const boardWidth = Math.max(1, boardRight - boardX);
  const boardHeight = Math.max(1, boardBottom - boardY);

  const topGap = compact ? 4 : 8;
  const dragonBudget = compact ? 78 : 132;
  const dealClusterGap = compact ? 10 : 18;
  const topFit = Math.max(1, (boardWidth - dragonBudget - topGap * 7 - dealClusterGap) / 7);
  const tableauMinGap = compact ? 5 : 10;
  const tableauFit = Math.max(1, (boardWidth - tableauMinGap * 7) / 8);
  const rowGap = compact ? 10 : 22;
  const bottomMargin = compact ? 8 : 18;
  // The taller production cards need a little more vertical budget on short,
  // wide desktop windows. Fan spacing is allowed to compress before card
  // width is sacrificed; long stacks are compressed further by layout.ts.
  const minimumFanGap = 12;
  const heightFit = Math.max(
    1,
    (boardHeight - rowGap - bottomMargin - minimumFanGap * 4) / (CARD_ASPECT_RATIO * 2),
  );
  const preferred = compact ? 84 : 118;
  const minimum = compact ? COMPACT_MIN_CARD_WIDTH : STANDARD_MIN_CARD_WIDTH;
  const rawCardWidth = Math.min(preferred, topFit, tableauFit, heightFit, MAX_CARD_WIDTH);
  const cardWidth = rawCardWidth >= minimum ? rawCardWidth : Math.max(1, rawCardWidth);
  const cardHeight = cardWidth * CARD_ASPECT_RATIO;

  const tableauPreferredGap = compact ? 8 : 18;
  const maxTableauGap = Math.max(0, (boardWidth - cardWidth * 8) / 7);
  const tableauColumnGap = Math.min(tableauPreferredGap, maxTableauGap);
  const tableauWidth = cardWidth * 8 + tableauColumnGap * 7;
  const tableauStartX = boardX + Math.max(0, (boardWidth - tableauWidth) / 2);
  const tableauX = Array.from({ length: 8 }, (_, index) => tableauStartX + index * (cardWidth + tableauColumnGap));

  const topY = boardY;
  const freeCells = Array.from({ length: 3 }, (_, index) => ({
    x: boardX + index * (cardWidth + topGap),
    y: topY,
  }));
  const foundationGroupWidth = cardWidth * 3 + topGap * 2;
  const foundationStart = boardRight - foundationGroupWidth;
  const flowerFoundation = {
    x: foundationStart - dealClusterGap - cardWidth,
    y: topY,
  };
  const dealOrigin = flowerFoundation;
  const foundations = Array.from({ length: 3 }, (_, index) => ({
    x: foundationStart + index * (cardWidth + topGap),
    y: topY,
  }));

  const leftEnd = freeCells[2].x + cardWidth;
  const centerStart = leftEnd + topGap;
  const centerEnd = flowerFoundation.x - topGap;
  const centerWidth = Math.max(1, centerEnd - centerStart);
  const dragonGap = compact ? 3 : 6;
  const dragonWidth = Math.max(1, Math.min(cardWidth * 0.5, (centerWidth - dragonGap * 2) / 3));
  const dragonHeight = Math.min(cardHeight * 0.34, compact ? 34 : 46);
  const dragonsWidth = dragonWidth * 3 + dragonGap * 2;
  const dragonStart = centerStart + Math.max(0, (centerWidth - dragonsWidth) / 2);
  const dragonControls = Array.from({ length: 3 }, (_, index) => ({
    x: dragonStart + index * (dragonWidth + dragonGap),
    y: topY + (cardHeight - dragonHeight) / 2,
    width: dragonWidth,
    height: dragonHeight,
  }));

  const tableauY = topY + cardHeight + rowGap;
  const preferredTableauGap = clamp(
    compact ? 28 : 40,
    cardHeight * (compact ? 0.3 : 0.27),
    compact ? 34 : 46,
  );
  const initialDealGapLimit = Math.max(0, (boardBottom - bottomMargin - tableauY - cardHeight) / 4);
  const tableauCardGap = Math.min(preferredTableauGap, initialDealGapLimit);

  const railX = boardRight + railGap;
  const controlHeight = compact ? 44 : 52;
  const controlGap = compact ? 8 : 12;
  const homeControl = { x: railX, y: boardY, width: controlRailWidth, height: controlHeight };
  const newDealControl = { x: railX, y: boardY + controlHeight + controlGap, width: controlRailWidth, height: controlHeight };
  const undoControl = { x: railX, y: boardY + (controlHeight + controlGap) * 2, width: controlRailWidth, height: controlHeight };
  return {
    viewportWidth: width,
    viewportHeight: height,
    profile,
    safeArea: insets,
    boardBounds: { x: boardX, y: boardY, width: boardWidth, height: boardHeight },
    cardWidth,
    cardHeight,
    tableauX,
    tableauY,
    tableauCardGap,
    freeCells,
    flowerFoundation,
    foundations,
    dragonControls,
    homeControl,
    newDealControl,
    undoControl,
    dealOrigin,
    bottomMargin,
  };
}

function scalePoint(point: LayoutPoint, scale: number): LayoutPoint {
  return { x: point.x * scale, y: point.y * scale };
}

function scaleBounds(bounds: LayoutBounds, scale: number): LayoutBounds {
  return { x: bounds.x * scale, y: bounds.y * scale, width: bounds.width * scale, height: bounds.height * scale };
}

export function scaleViewportLayout(layout: ViewportLayout, renderScale: number): ViewportLayout {
  const scale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
  if (scale === 1) return layout;
  return {
    viewportWidth: layout.viewportWidth * scale,
    viewportHeight: layout.viewportHeight * scale,
    profile: layout.profile,
    safeArea: {
      top: layout.safeArea.top * scale,
      right: layout.safeArea.right * scale,
      bottom: layout.safeArea.bottom * scale,
      left: layout.safeArea.left * scale,
    },
    boardBounds: scaleBounds(layout.boardBounds, scale),
    cardWidth: layout.cardWidth * scale,
    cardHeight: layout.cardHeight * scale,
    tableauX: layout.tableauX.map((x) => x * scale),
    tableauY: layout.tableauY * scale,
    tableauCardGap: layout.tableauCardGap * scale,
    freeCells: layout.freeCells.map((point) => scalePoint(point, scale)),
    flowerFoundation: scalePoint(layout.flowerFoundation, scale),
    foundations: layout.foundations.map((point) => scalePoint(point, scale)),
    dragonControls: layout.dragonControls.map((bounds) => scaleBounds(bounds, scale)),
    homeControl: scaleBounds(layout.homeControl, scale),
    newDealControl: scaleBounds(layout.newDealControl, scale),
    undoControl: scaleBounds(layout.undoControl, scale),
    dealOrigin: scalePoint(layout.dealOrigin, scale),
    bottomMargin: layout.bottomMargin * scale,
  };
}
