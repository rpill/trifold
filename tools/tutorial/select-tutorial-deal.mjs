import { readFileSync, writeFileSync } from 'node:fs';
import { createDeal } from '../../src/game/model/deal.ts';
import { TrifoldGame } from '../../src/game/model/TrifoldGame.ts';
import {
  compactStateFromSnapshot,
  generateHintCandidates,
  hintStateKey,
  normalizeHintState,
} from '../../src/game/hints/HintSearchState.ts';
import { findWinningProof } from '../../src/game/hints/HintSearch.ts';

const ROOT = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('public/assets/deals/verified-deals-manifest.json', ROOT), 'utf8'));
const binary = readFileSync(new URL('public/assets/deals/verified-deals.bin', ROOT));
const onboarding = Array.from({ length: manifest.offsets.onboarding.count }, (_, index) => binary.readUInt32LE(index * 4));

function foundationSum(state) {
  return state.foundations[0] + state.foundations[1] + state.foundations[2];
}

function classify(parent, candidate) {
  const command = candidate.command;
  const manualFoundation = command.type === 'move' && command.target.zone === 'foundation' ? 1 : 0;
  return {
    sequence: command.type === 'move'
      && command.source.zone === 'tableau'
      && command.target.zone === 'tableau'
      && command.source.index < parent.tableau[command.source.column].length - 1,
    freeCell: command.type === 'move' && command.target.zone === 'free-cell',
    flowerAuto: !parent.flower && candidate.child.flower,
    foundationAuto: foundationSum(candidate.child) - foundationSum(parent) - manualFoundation > 0,
    dragons: command.type === 'collect-dragons',
    move: command.type === 'move',
  };
}

function advance(phase, facts) {
  if (phase === 0 && facts.sequence) return 1;
  if (phase === 1 && facts.freeCell) return 2;
  if (phase === 2 && facts.flowerAuto) return 3;
  if (phase === 3 && facts.foundationAuto) return 4;
  if (phase === 4 && facts.dragons) return 5;
  if (phase === 5 && facts.move) return 6;
  return phase;
}

function legalBeforeLesson(phase, facts) {
  if (phase < 2 && facts.flowerAuto) return false;
  if (phase < 3 && facts.foundationAuto) return false;
  if (phase < 4 && facts.dragons) return false;
  if (phase === 0 && facts.freeCell) return false;
  return true;
}

function tutorialPath(seed, maxNodes = 20_000, maxDepth = 35) {
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  const initial = normalizeHintState(compactStateFromSnapshot(game.snapshot()));
  const visited = new Set();
  const stack = [{ state: initial, phase: 0, path: [], milestones: [] }];
  let nodes = 0;

  while (stack.length > 0 && nodes < maxNodes) {
    const current = stack.pop();
    if (current.phase === 6) return { path: current.path, milestones: current.milestones, nodes };
    if (current.path.length >= maxDepth) continue;
    const key = `${current.phase}|${hintStateKey(current.state)}`;
    if (visited.has(key)) continue;
    visited.add(key);
    nodes += 1;

    const candidates = [...generateHintCandidates(current.state)];
    candidates.sort((left, right) => {
      const leftAdvance = advance(current.phase, classify(current.state, left)) > current.phase ? 1 : 0;
      const rightAdvance = advance(current.phase, classify(current.state, right)) > current.phase ? 1 : 0;
      if (leftAdvance !== rightAdvance) return leftAdvance - rightAdvance;
      return right.score - left.score || left.order - right.order;
    });

    for (const candidate of candidates) {
      const facts = classify(current.state, candidate);
      if (!legalBeforeLesson(current.phase, facts)) continue;
      const nextPhase = advance(current.phase, facts);
      stack.push({
        state: candidate.child,
        phase: nextPhase,
        path: [...current.path, candidate.command],
        milestones: nextPhase > current.phase ? [...current.milestones, current.path.length] : current.milestones,
      });
    }
  }
  return null;
}

function verifyScenario(seed, path, milestones) {
  const game = new TrifoldGame(createDeal(seed));
  game.settleInitialAutoMoves();
  let flowerSeen = false;
  let foundationSeen = false;
  for (let index = 0; index < path.length; index += 1) {
    const result = game.perform(path[index]);
    if (!result) throw new Error(`Tutorial selector produced illegal command seed=${seed} index=${index}`);
    if (index === milestones[2]) flowerSeen = result.operations.some((operation) => operation.reason === 'auto' && operation.to.zone === 'flower-foundation');
    if (index === milestones[3]) foundationSeen = result.operations.some((operation) => operation.reason === 'auto' && operation.to.zone === 'foundation');
  }
  if (!flowerSeen || !foundationSeen) throw new Error('Tutorial auto checkpoints failed production replay.');
  if (!game.undo()) throw new Error('Tutorial Undo checkpoint is not reversible.');
  if (findWinningProof(game.snapshot(), { maxNodes: 250_000 }).status !== 'SOLVED') {
    throw new Error('Tutorial post-Undo state is not runtime-solver winnable.');
  }
}

let selected = null;
for (const seed of onboarding) {
  const result = tutorialPath(seed);
  if (!result) continue;
  const [sequence, freeCell, flowerAuto, foundationAuto, dragons, undoMove] = result.milestones;
  const guidedLength = undoMove - sequence + 1;
  if (result.path.length > 12 || guidedLength > 10) continue;
  verifyScenario(seed, result.path, result.milestones);
  selected = { seed, result, indices: { sequence, freeCell, flowerAuto, foundationAuto, dragons, undoMove } };
  break;
}
if (!selected) throw new Error('No onboarding tutorial candidate met the deterministic v1 constraints.');

const start = selected.indices.sequence;
const guided = selected.result.path.slice(start, selected.indices.undoMove + 1);
const relative = Object.fromEntries(Object.entries(selected.indices).map(([key, value]) => [key, value - start]));
const literal = (value) => JSON.stringify(value, null, 2).replaceAll('"type"', 'type').replaceAll('"source"', 'source').replaceAll('"target"', 'target').replaceAll('"zone"', 'zone').replaceAll('"column"', 'column').replaceAll('"index"', 'index').replaceAll('"cell"', 'cell').replaceAll('"family"', 'family');

const output = `import type { PlayerCommand } from '../game/model/types.ts';\n\nexport interface TutorialScenario {\n  readonly seed: number;\n  readonly bootstrapCommands: readonly PlayerCommand[];\n  readonly guidedCommands: readonly PlayerCommand[];\n  readonly milestones: { readonly sequence: number; readonly freeCell: number; readonly flowerAuto: number; readonly foundationAuto: number; readonly dragons: number; readonly undoMove: number };\n}\n\nexport const TUTORIAL_SCENARIO: TutorialScenario = Object.freeze({\n  seed: ${selected.seed},\n  bootstrapCommands: Object.freeze(${literal(selected.result.path.slice(0, start))} satisfies PlayerCommand[]),\n  guidedCommands: Object.freeze(${literal(guided)} satisfies PlayerCommand[]),\n  milestones: Object.freeze(${JSON.stringify(relative, null, 2)}),\n});\n`;
writeFileSync(new URL('src/tutorial/TutorialScenario.ts', ROOT), output);
console.log(`tutorial seed=${selected.seed} searchNodes=${selected.result.nodes} bootstrap=${start} guided=${guided.length}`);
