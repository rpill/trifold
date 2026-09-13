import { createDeck } from './cards.ts';
import { SeededRandom } from './SeededRandom.ts';
import type { CardId, TrifoldDeal } from './types.ts';

export const DEAL_FORMAT_VERSION = 1 as const;
export const SHUFFLE_VERSION = 1 as const;
export const RULES_VERSION = 1 as const;

export function createDeal(seed: number): TrifoldDeal {
  const random = new SeededRandom(seed);
  const shuffled = [...createDeck()];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const tableau: CardId[][] = Array.from({ length: 8 }, () => []);
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const card = shuffled[row * 8 + column];
      if (!card) throw new Error('Shuffled deck is incomplete.');
      tableau[column].push(card.id);
    }
  }

  return {
    seed: seed >>> 0,
    dealFormatVersion: DEAL_FORMAT_VERSION,
    shuffleVersion: SHUFFLE_VERSION,
    tableau: tableau.map((column) => Object.freeze([...column])),
  };
}

export function getInitialDealSequence(deal: TrifoldDeal): readonly CardId[] {
  const sequence: CardId[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const cardId = deal.tableau[column]?.[row];
      if (cardId === undefined) throw new Error('Deal must contain exactly eight columns of five cards.');
      sequence.push(cardId);
    }
  }
  return sequence;
}
