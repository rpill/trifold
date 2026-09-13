const CARDS_PER_LAYER = 5;
const FULL_DECK_SIZE = 40;
const STANDARD_LAYER_GAP = 3;
const COMPACT_LAYER_GAP = 1;

type DealStackLayoutProfile = 'standard' | 'compact-landscape';

export const MAX_DEAL_STACK_LAYERS = Math.ceil(FULL_DECK_SIZE / CARDS_PER_LAYER);

export class DealStackVisualState {
  private visibleCardCount: number;

  constructor(cardCount: number) {
    this.visibleCardCount = Math.max(0, cardCount);
  }

  get cardCount(): number {
    return this.visibleCardCount;
  }

  get layerCount(): number {
    if (this.visibleCardCount === 0) return 0;
    return Math.min(MAX_DEAL_STACK_LAYERS, Math.ceil(this.visibleCardCount / CARDS_PER_LAYER));
  }

  getLayerOffsets(profile: DealStackLayoutProfile): readonly number[] {
    const layerGap = profile === 'compact-landscape' ? COMPACT_LAYER_GAP : STANDARD_LAYER_GAP;
    return Array.from({ length: this.layerCount }, (_, index) => 0 - index * layerGap);
  }

  removeDealtCard(): void {
    this.visibleCardCount = Math.max(0, this.visibleCardCount - 1);
  }

  sync(cardCount: number): void {
    this.visibleCardCount = Math.max(0, cardCount);
  }
}
