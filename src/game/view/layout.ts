import type { LayoutBounds, ViewportLayout } from './ViewportLayout.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function tableauCardY(layout: ViewportLayout, cardCount: number, index: number): number {
  const boardBottom = layout.boardBounds.y + layout.boardBounds.height;
  const available = boardBottom - layout.tableauY - layout.cardHeight - layout.bottomMargin;
  const gap = cardCount <= 1
    ? layout.tableauCardGap
    : Math.min(layout.tableauCardGap, Math.max(0, available / (cardCount - 1)));
  return layout.tableauY + index * gap;
}

export function cardBounds(x: number, y: number, layout: Pick<ViewportLayout, 'cardWidth' | 'cardHeight'>): LayoutBounds {
  return { x, y, width: layout.cardWidth, height: layout.cardHeight };
}
