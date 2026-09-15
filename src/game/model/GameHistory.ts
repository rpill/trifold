import type { CardOperation, TrifoldSnapshot } from './types.ts';

export interface HistoryEntry {
  readonly before: TrifoldSnapshot;
  readonly forwardOperations: readonly CardOperation[];
}

export interface GameHistorySaveV1 {
  readonly version: 1;
  readonly entries: readonly HistoryEntry[];
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

function cloneOperation(operation: CardOperation): CardOperation {
  return {
    ...operation,
    from: { ...operation.from },
    to: { ...operation.to },
  };
}

function cloneEntry(entry: HistoryEntry): HistoryEntry {
  return {
    before: cloneSnapshot(entry.before),
    forwardOperations: entry.forwardOperations.map(cloneOperation),
  };
}

export class GameHistory {
  private readonly entries: HistoryEntry[] = [];

  get canUndo(): boolean {
    return this.entries.length > 0;
  }

  push(entry: HistoryEntry): void {
    this.entries.push(cloneEntry(entry));
  }

  pop(): HistoryEntry | null {
    return this.entries.pop() ?? null;
  }

  clear(): void {
    this.entries.length = 0;
  }

  exportSave(): GameHistorySaveV1 {
    return {
      version: 1,
      entries: this.entries.map(cloneEntry),
    };
  }

  restore(save: GameHistorySaveV1): void {
    if (save.version !== 1 || !Array.isArray(save.entries)) {
      throw new Error('Unsupported game history save version.');
    }
    this.clear();
    for (const entry of save.entries) this.entries.push(cloneEntry(entry));
  }
}
