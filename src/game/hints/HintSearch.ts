import { TrifoldGame } from '../model/TrifoldGame.ts';
import type { PlayerCommand, TrifoldSnapshot } from '../model/types.ts';
import {
  compactStateFromSnapshot,
  generateHintCandidates,
  hintStateKey,
  hintStateWon,
  normalizeHintState,
  type HintCandidate,
  type HintCompactState,
} from './HintSearchState.ts';

export interface HintSearchOptions {
  readonly maxNodes?: number;
  readonly maxDecisionDepth?: number;
}

export type HintSearchResult =
  | { readonly status: 'SOLVED'; readonly nodes: number; readonly proof: readonly PlayerCommand[] }
  | { readonly status: 'UNDETERMINED'; readonly nodes: number }
  | { readonly status: 'UNSOLVABLE'; readonly nodes: number };

interface SearchFrame {
  readonly state: HintCompactState;
  candidates: readonly HintCandidate[] | null;
  nextCandidate: number;
  readonly ownsPathCommand: boolean;
}

function verifyProof(snapshot: TrifoldSnapshot, proof: readonly PlayerCommand[]): boolean {
  try {
    const game = TrifoldGame.restore({
      version: 1,
      seed: snapshot.seed,
      snapshot,
      history: { version: 1, entries: [] },
    });
    game.settleInitialAutoMoves();
    for (const command of proof) {
      if (!game.perform(command)) return false;
    }
    const state = game.state;
    return state.flowerFoundation === 'flower'
      && state.foundations.coins.length === 9
      && state.foundations.bamboo.length === 9
      && state.foundations.characters.length === 9
      && ['red', 'green', 'white'].every((family) => state.freeCells.some(
        (cell) => cell.kind === 'dragons' && cell.family === family && cell.cardIds.length === 4,
      ));
  } catch {
    return false;
  }
}

export function findWinningProof(snapshot: TrifoldSnapshot, options: HintSearchOptions = {}): HintSearchResult {
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? 250_000));
  const maxDecisionDepth = Math.max(1, Math.floor(options.maxDecisionDepth ?? 2_000));
  const initial = normalizeHintState(compactStateFromSnapshot(snapshot));
  const visited = new Set<string>();
  const path: PlayerCommand[] = [];
  let nodes = 0;
  let depthLimited = false;

  const stack: SearchFrame[] = [{ state: initial, candidates: null, nextCandidate: 0, ownsPathCommand: false }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (hintStateWon(frame.state)) {
      const proof = [...path];
      return verifyProof(snapshot, proof)
        ? { status: 'SOLVED', nodes, proof }
        : { status: 'UNDETERMINED', nodes };
    }

    if (frame.candidates === null) {
      if (path.length >= maxDecisionDepth) {
        depthLimited = true;
        stack.pop();
        if (frame.ownsPathCommand) path.pop();
        continue;
      }
      if (nodes >= maxNodes) return { status: 'UNDETERMINED', nodes };
      nodes += 1;
      const key = hintStateKey(frame.state);
      if (visited.has(key)) {
        stack.pop();
        if (frame.ownsPathCommand) path.pop();
        continue;
      }
      visited.add(key);
      frame.candidates = generateHintCandidates(frame.state);
      frame.nextCandidate = 0;
    }

    const candidate = frame.candidates[frame.nextCandidate];
    if (!candidate) {
      stack.pop();
      if (frame.ownsPathCommand) path.pop();
      continue;
    }
    frame.nextCandidate += 1;
    path.push(candidate.command);
    stack.push({ state: candidate.child, candidates: null, nextCandidate: 0, ownsPathCommand: true });
  }

  return depthLimited ? { status: 'UNDETERMINED', nodes } : { status: 'UNSOLVABLE', nodes };
}
