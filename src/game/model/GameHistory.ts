import type { CardOperation, TrifoldSnapshot } from './types.ts';

export interface HistoryEntry {
  readonly before: TrifoldSnapshot;
  readonly forwardOperations: readonly CardOperation[];
}

function cloneSnapshot(snapshot: TrifoldSnapshot): TrifoldSnapshot {
  return {
    seed: snapshot.seed,
    tableau: snapshot.tableau.map((column) => [...column]),
    freeCells: snapshot.freeCells.map((cell) => {
      if (cell.kind === 'dragons') return { ...cell, cardIds: [...cell.cardIds] };
      return { ...cell };
    }),
    foundations: {
      coins: [...snapshot.foundations.coins],
      bamboo: [...snapshot.foundations.bamboo],
      characters: [...snapshot.foundations.characters],
    },
    flowerFoundation: snapshot.flowerFoundation,
  };
}

export class GameHistory {
  private readonly entries: HistoryEntry[] = [];

  get canUndo(): boolean {
    return this.entries.length > 0;
  }

  push(entry: HistoryEntry): void {
    this.entries.push({
      before: cloneSnapshot(entry.before),
      forwardOperations: entry.forwardOperations.map((operation) => ({
        ...operation,
        from: { ...operation.from },
        to: { ...operation.to },
      })),
    });
  }

  pop(): HistoryEntry | null {
    return this.entries.pop() ?? null;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
