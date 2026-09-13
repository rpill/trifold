export type NumericSuit = 'coins' | 'bamboo' | 'characters';
export type DragonFamily = 'red' | 'green' | 'white';
export type CardId = string;

export type TrifoldCard =
  | { readonly id: CardId; readonly kind: 'number'; readonly suit: NumericSuit; readonly rank: number }
  | { readonly id: CardId; readonly kind: 'dragon'; readonly family: DragonFamily; readonly copy: 1 | 2 | 3 | 4 }
  | { readonly id: 'flower'; readonly kind: 'flower' };

export type FreeCellState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'card'; readonly cardId: CardId }
  | { readonly kind: 'dragons'; readonly family: DragonFamily; readonly cardIds: readonly CardId[] };

export interface TrifoldDeal {
  readonly seed: number;
  readonly dealFormatVersion: 1;
  readonly shuffleVersion: 1;
  readonly tableau: readonly (readonly CardId[])[];
}

export interface ReadonlyTrifoldState {
  readonly tableau: readonly (readonly CardId[])[];
  readonly freeCells: readonly FreeCellState[];
  readonly foundations: Readonly<Record<NumericSuit, readonly CardId[]>>;
  readonly flowerFoundation: CardId | null;
}

export type CardSource =
  | { readonly zone: 'tableau'; readonly column: number; readonly index: number }
  | { readonly zone: 'free-cell'; readonly cell: number };

export type CardTarget =
  | { readonly zone: 'tableau'; readonly column: number }
  | { readonly zone: 'free-cell'; readonly cell: number }
  | { readonly zone: 'foundation'; readonly suit: NumericSuit };

export interface AutoMove {
  readonly source: CardSource;
  readonly target:
    | { readonly zone: 'foundation'; readonly suit: NumericSuit }
    | { readonly zone: 'flower-foundation' };
}

export interface DragonCollection {
  readonly family: DragonFamily;
  readonly sources: readonly CardSource[];
  readonly destinationCell: number;
}

export type PlayerCommand =
  | { readonly type: 'move'; readonly source: CardSource; readonly target: CardTarget }
  | { readonly type: 'collect-dragons'; readonly family: DragonFamily };

export type CardLocation =
  | { readonly zone: 'tableau'; readonly column: number; readonly index: number }
  | { readonly zone: 'free-cell'; readonly cell: number }
  | { readonly zone: 'foundation'; readonly suit: NumericSuit; readonly index: number }
  | { readonly zone: 'flower-foundation' }
  | { readonly zone: 'dragon-cell'; readonly cell: number; readonly family: DragonFamily };

export interface CardOperation {
  readonly type: 'move-card';
  readonly cardId: CardId;
  readonly from: CardLocation;
  readonly to: CardLocation;
  readonly reason: 'player' | 'auto' | 'dragon';
}

export interface TransactionResult {
  readonly operations: readonly CardOperation[];
  readonly won: boolean;
}

export interface TrifoldSnapshot extends ReadonlyTrifoldState {
  readonly seed: number;
}
