import type { DragonFamily, NumericSuit, TrifoldCard } from './types.ts';

export const NUMERIC_SUITS = ['coins', 'bamboo', 'characters'] as const satisfies readonly NumericSuit[];
export const DRAGON_FAMILIES = ['red', 'green', 'white'] as const satisfies readonly DragonFamily[];

export function createDeck(): readonly TrifoldCard[] {
  const cards: TrifoldCard[] = [];

  for (const suit of NUMERIC_SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      cards.push(Object.freeze({ id: `${suit}-${rank}`, kind: 'number', suit, rank }));
    }
  }

  for (const family of DRAGON_FAMILIES) {
    for (let copy = 1 as 1 | 2 | 3 | 4; copy <= 4; copy = (copy + 1) as 1 | 2 | 3 | 4) {
      cards.push(Object.freeze({ id: `dragon-${family}-${copy}`, kind: 'dragon', family, copy }));
    }
  }

  cards.push(Object.freeze({ id: 'flower', kind: 'flower' }));
  return Object.freeze(cards);
}
