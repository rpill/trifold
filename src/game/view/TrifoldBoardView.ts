import Phaser from 'phaser';
import { createDeck } from '../model/cards.ts';
import { createDeal, getInitialDealSequence } from '../model/deal.ts';
import { TrifoldGame } from '../model/TrifoldGame.ts';
import {
  canDropInFreeCell,
  canDropOnTableau,
  canMoveToFoundation,
  getCard,
  canPickUp,
  cardsFromSource,
} from '../model/TrifoldRules.ts';
import type {
  CardId,
  CardLocation,
  CardOperation,
  CardSource,
  DragonFamily,
  PlayerCommand,
  TransactionResult,
} from '../model/types.ts';
import type { SfxCue } from '../../settings/SfxController.ts';
import { DEAL_STAGGER_MS, getCardMotionDuration, getDealFlightOriginY } from './CardAnimation.ts';
import { getCardFlightPoint } from './CardFlight.ts';
import { getCardDepthTransition } from './CardMotionDepth.ts';
import { isCommittedCardDrop } from './DropGeometry.ts';
import { tableauCardY } from './layout.ts';
import { drawSchematicCardBack, SchematicCardView } from './SchematicCardView.ts';
import { DealStackVisualState } from './DealStackVisualState.ts';
import type { ViewportLayout } from './ViewportLayout.ts';

export interface BoardActions {
  readonly perform: (command: PlayerCommand) => TransactionResult | null;
  readonly settleInitialAutoMoves: () => TransactionResult;
  readonly undo: () => TransactionResult | null;
  readonly sound: (cue: SfxCue) => void;
  readonly settled: () => void;
}

interface CardPlacement {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly source: CardSource | null;
}

interface DragMember {
  readonly cardId: CardId;
  readonly startX: number;
  readonly startY: number;
}

interface DragState {
  readonly rootCardId: CardId;
  readonly source: CardSource;
  readonly members: readonly DragMember[];
}


function membersDepthOffset(cardId: CardId, cardIds: readonly CardId[]): number {
  return Math.max(0, cardIds.indexOf(cardId));
}

export class TrifoldBoardView {
  private readonly scene: Phaser.Scene;
  private readonly game: TrifoldGame;
  private readonly actions: BoardActions;
  private readonly cards = new Map<CardId, SchematicCardView>();
  private readonly slots: Phaser.GameObjects.Graphics;
  private readonly dealStack: Phaser.GameObjects.Graphics;
  private readonly dealStackVisual = new DealStackVisualState(0);
  private readonly slotLabels: Phaser.GameObjects.Text[] = [];
  private readonly activeTweens = new Set<Phaser.Tweens.Tween>();
  private readonly activeTimers = new Set<Phaser.Time.TimerEvent>();
  private readonly dragDistanceThreshold: number;
  private layout: ViewportLayout;
  private inputLocked = true;
  private uiPaused = false;
  private initialDealPending = false;
  private dragState: DragState | null = null;
  private lastTap: { readonly cardId: CardId; readonly time: number } | null = null;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    game: TrifoldGame,
    actions: BoardActions,
    layout: ViewportLayout,
  ) {
    this.scene = scene;
    this.game = game;
    this.actions = actions;
    this.layout = layout;
    this.dragDistanceThreshold = scene.input.dragDistanceThreshold;
    this.slots = scene.add.graphics().setDepth(2);
    this.dealStack = scene.add.graphics().setDepth(4);

    for (const card of createDeck()) {
      const view = new SchematicCardView(scene, card.id, layout.cardWidth, layout.cardHeight);
      view.setVisible(false);
      this.cards.set(card.id, view);
      this.installCardInput(card.id, view);
    }
    this.createSlotLabels();
    this.redrawSlots();
  }

  playInitialDeal(): void {
    if (this.destroyed) return;
    this.cancelAnimations();
    this.inputLocked = true;
    this.initialDealPending = true;
    this.syncVisibility(false);

    const sequence = getInitialDealSequence(createDeal(this.game.snapshot().seed));
    this.dealStackVisual.sync(sequence.length);
    this.updateDealStack();
    sequence.forEach((cardId, index) => {
      const timer = this.scene.time.delayedCall(index * DEAL_STAGGER_MS, () => {
        this.activeTimers.delete(timer);
        if (this.destroyed || !this.initialDealPending) return;
        const view = this.cards.get(cardId);
        const placement = this.calculatePlacements().get(cardId);
        if (!view || !placement) return;
        const dealOriginY = getDealFlightOriginY(
          this.layout.dealOrigin.y,
          this.dealStackVisual.getLayerOffsets(this.layout.profile),
        );
        this.dealStackVisual.removeDealtCard();
        this.updateDealStack();
        view.setVisible(true);
        view.setFaceDown(false);
        view.setPosition(this.layout.dealOrigin.x, dealOriginY);
        view.setDepth(3000 + index);
        this.actions.sound('deal');
        this.animateCard(cardId, placement, getCardMotionDuration('deal'), () => {
          if (index !== sequence.length - 1 || !this.initialDealPending) return;
          this.initialDealPending = false;
          this.dealStackVisual.sync(0);
          this.updateDealStack();
          const settle = this.actions.settleInitialAutoMoves();
          this.playOperationList(settle.operations, () => {
            this.syncToState();
            this.inputLocked = this.uiPaused || settle.won;
            this.actions.settled();
          });
        });
      });
      this.activeTimers.add(timer);
    });
  }

  relayout(layout: ViewportLayout): void {
    if (this.destroyed) return;
    const wasInitialDeal = this.initialDealPending;
    this.cancelAnimations();
    this.dragState = null;
    this.initialDealPending = false;
    this.dealStackVisual.sync(0);
    this.dealStack.clear();
    this.dealStack.setVisible(false);
    this.layout = layout;
    for (const view of this.cards.values()) view.relayout(layout.cardWidth, layout.cardHeight);
    this.redrawSlots();
    if (wasInitialDeal) this.actions.settleInitialAutoMoves();
    this.syncToState();
    this.inputLocked = this.uiPaused;
    this.actions.settled();
  }

  requestUndo(): void {
    if (this.inputLocked || this.uiPaused) return;
    const result = this.actions.undo();
    if (!result) return;
    this.dragState = null;
    this.inputLocked = true;
    this.actions.sound('undo');
    this.playOperationList(result.operations, () => {
      this.syncToState();
      this.inputLocked = this.uiPaused || result.won;
      this.actions.settled();
    }, 'undo', getCardMotionDuration('undo'));
  }

  collectDragons(family: DragonFamily): void {
    if (this.inputLocked || this.uiPaused) return;
    const result = this.actions.perform({ type: 'collect-dragons', family });
    if (!result) return;
    this.dragState = null;
    this.inputLocked = true;
    this.actions.sound('button');
    const dragonOperations = result.operations.filter((operation) => operation.reason === 'dragon');
    const automaticOperations = result.operations.filter((operation) => operation.reason === 'auto');
    this.animateOperationsConcurrently(dragonOperations, getCardMotionDuration('player'), () => {
      this.playOperationList(automaticOperations, () => {
        this.syncToState();
        this.inputLocked = this.uiPaused || result.won;
        this.actions.settled();
      });
    });
  }

  setUiPaused(paused: boolean): void {
    this.uiPaused = paused;
    if (paused) this.inputLocked = true;
    else if (!this.initialDealPending) this.inputLocked = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelAnimations();
    for (const view of this.cards.values()) view.destroy();
    this.cards.clear();
    this.slots.destroy();
    this.dealStack.destroy();
    for (const label of this.slotLabels) label.destroy();
    this.slotLabels.length = 0;
  }

  private installCardInput(cardId: CardId, view: SchematicCardView): void {
    view.input.on('pointerdown', () => this.handlePointerDown(cardId));
    view.input.on('dragstart', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.handleDragStart(cardId, dragX, dragY);
    });
    view.input.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      this.handleDrag(cardId, dragX, dragY);
    });
    view.input.on('dragend', () => this.handleDragEnd(cardId));
  }

  private handlePointerDown(cardId: CardId): void {
    if (this.inputLocked || this.uiPaused) return;
    const placement = this.calculatePlacements().get(cardId);
    if (!placement?.source || !canPickUp(this.game.state, placement.source)) return;
    this.actions.sound('card-touch');

    const now = this.scene.time.now;
    const isDoubleTap = this.lastTap?.cardId === cardId
      && now - this.lastTap.time < 300;
    this.lastTap = { cardId, time: now };
    if (!isDoubleTap) return;

    const card = getCard(cardId);
    if (card.kind !== 'number' || !canMoveToFoundation(this.game.state, placement.source, card.suit)) return;
    const result = this.actions.perform({
      type: 'move',
      source: placement.source,
      target: { zone: 'foundation', suit: card.suit },
    });
    if (!result) return;

    this.lastTap = null;
    this.dragState = null;
    this.inputLocked = true;
    this.actions.sound('card-place');
    const playerOperations = result.operations.filter((operation) => operation.reason === 'player');
    const automaticOperations = result.operations.filter((operation) => operation.reason === 'auto');
    this.animateOperationsConcurrently(playerOperations, getCardMotionDuration('player'), () => {
      this.playOperationList(automaticOperations, () => {
        this.syncToState();
        this.inputLocked = this.uiPaused || result.won;
        this.actions.settled();
      });
    });
  }

  private handleDragStart(cardId: CardId, _dragX: number, _dragY: number): void {
    if (this.inputLocked || this.uiPaused) return;
    if (this.dragState) return;
    const placements = this.calculatePlacements();
    const placement = placements.get(cardId);
    if (!placement?.source || !canPickUp(this.game.state, placement.source)) return;
    const cardIds = cardsFromSource(this.game.state, placement.source);
    const members = cardIds.flatMap((memberId) => {
      const memberView = this.cards.get(memberId);
      if (!memberView) return [];
      const depth = getCardDepthTransition(memberView.input.depth, memberView.input.depth, true, true);
      memberView.setDepth(depth.active + membersDepthOffset(memberId, cardIds));
      return [{ cardId: memberId, startX: memberView.input.x, startY: memberView.input.y }];
    });
    if (members.length !== cardIds.length) return;
    this.dragState = { rootCardId: cardId, source: placement.source, members };
  }

  private handleDrag(cardId: CardId, dragX: number, dragY: number): void {
    const drag = this.dragState;
    if (!drag || drag.rootCardId !== cardId || this.inputLocked || this.uiPaused) return;
    const root = drag.members[0];
    if (!root) return;
    const deltaX = dragX - root.startX;
    const deltaY = dragY - root.startY;
    drag.members.forEach((member) => {
      const view = this.cards.get(member.cardId);
      view?.setPosition(member.startX + deltaX, member.startY + deltaY);
    });
  }

  private handleDragEnd(cardId: CardId): void {
    const drag = this.dragState;
    if (!drag || drag.rootCardId !== cardId || this.inputLocked || this.uiPaused) {
      this.dragState = null;
      return;
    }
    const command = this.resolveDropCommand(drag);
    if (!command) {
      this.snapBack(drag);
      return;
    }
    const result = this.actions.perform(command);
    if (!result) {
      this.snapBack(drag);
      return;
    }

    this.dragState = null;
    this.inputLocked = true;
    this.actions.sound('card-place');
    const playerOperations = result.operations.filter((operation) => operation.reason === 'player');
    const automaticOperations = result.operations.filter((operation) => operation.reason === 'auto');

    // Direct drag/drop in Cascade settles on release with no travel tween. Only the
    // automatic follow-up chain is animated after the dragged cards have snapped.
    this.applyOperationsImmediately(playerOperations);
    this.playOperationList(automaticOperations, () => {
      this.syncToState();
      this.inputLocked = this.uiPaused || result.won;
      this.actions.settled();
    });
  }

  private resolveDropCommand(drag: DragState): PlayerCommand | null {
    const rootView = this.cards.get(drag.rootCardId);
    if (!rootView) return null;
    const moving = {
      x: rootView.input.x,
      y: rootView.input.y,
      width: this.layout.cardWidth,
      height: this.layout.cardHeight,
    };
    const state = this.game.state;

    for (let cell = 0; cell < this.layout.freeCells.length; cell += 1) {
      const point = this.layout.freeCells[cell];
      const target = { x: point.x, y: point.y, width: this.layout.cardWidth, height: this.layout.cardHeight };
      if (isCommittedCardDrop(moving, target) && canDropInFreeCell(state, drag.source, cell)) {
        return { type: 'move', source: drag.source, target: { zone: 'free-cell', cell } };
      }
    }

    const suits = ['coins', 'bamboo', 'characters'] as const;
    for (let index = 0; index < this.layout.foundations.length; index += 1) {
      const point = this.layout.foundations[index];
      const suit = suits[index];
      const target = { x: point.x, y: point.y, width: this.layout.cardWidth, height: this.layout.cardHeight };
      if (suit && isCommittedCardDrop(moving, target) && canMoveToFoundation(state, drag.source, suit)) {
        return { type: 'move', source: drag.source, target: { zone: 'foundation', suit } };
      }
    }

    for (let column = 0; column < this.layout.tableauX.length; column += 1) {
      const targetCards = state.tableau[column] ?? [];
      const targetY = targetCards.length === 0
        ? this.layout.tableauY
        : tableauCardY(this.layout, targetCards.length, targetCards.length - 1);
      const target = {
        x: this.layout.tableauX[column],
        y: targetY,
        width: this.layout.cardWidth,
        height: this.layout.cardHeight,
      };
      if (isCommittedCardDrop(moving, target) && canDropOnTableau(state, drag.source, column)) {
        return { type: 'move', source: drag.source, target: { zone: 'tableau', column } };
      }
    }
    return null;
  }

  private snapBack(_drag: DragState): void {
    this.dragState = null;
    this.actions.sound('card-place');
    this.syncToState();
    this.inputLocked = this.uiPaused;
    this.actions.settled();
  }

  private applyOperationsImmediately(operations: readonly CardOperation[]): void {
    for (const operation of operations) {
      const target = this.pointForLocation(operation.to);
      const view = this.cards.get(operation.cardId);
      if (!target || !view) continue;
      view.setVisible(true);
      view.setFaceDown(false);
      view.setPosition(target.x, target.y);
      view.setDepth(target.depth);
    }
  }

  private animateOperationsConcurrently(
    operations: readonly CardOperation[],
    duration: number,
    onComplete: () => void,
  ): void {
    if (operations.length === 0) {
      onComplete();
      return;
    }
    let remaining = operations.length;
    for (const operation of operations) {
      const target = this.pointForLocation(operation.to);
      if (!target) {
        remaining -= 1;
        if (remaining === 0) onComplete();
        continue;
      }
      this.animateCard(operation.cardId, target, duration, () => {
        remaining -= 1;
        if (remaining === 0) onComplete();
      });
    }
  }

  private createSlotLabels(): void {
    for (const text of ['FREE', 'FREE', 'FREE', 'F', 'R', 'G', 'B', 'RD', 'GD', 'WD']) {
      this.slotLabels.push(this.scene.add.text(0, 0, text, {
        color: '#a9bbb2',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(3));
    }
  }

  private redrawSlots(): void {
    const lineWidth = Math.max(1, this.layout.cardWidth * 0.015);
    const radius = Math.max(4, this.layout.cardWidth * 0.06);
    const freeSlotAlpha = 0.42;
    const foundationSlotAlpha = 0.56;

    this.slots.clear();
    this.slots.lineStyle(lineWidth, 0x8aa095, freeSlotAlpha);
    for (const point of this.layout.freeCells) {
      this.slots.strokeRoundedRect(
        point.x,
        point.y,
        this.layout.cardWidth,
        this.layout.cardHeight,
        radius,
      );
    }

    this.slots.lineStyle(lineWidth, 0x8aa095, foundationSlotAlpha);
    const foundationSlots = [this.layout.flowerFoundation, ...this.layout.foundations];
    for (const point of foundationSlots) {
      this.slots.strokeRoundedRect(
        point.x,
        point.y,
        this.layout.cardWidth,
        this.layout.cardHeight,
        radius,
      );
    }

    this.slots.lineStyle(Math.max(1, lineWidth * 0.9), 0x8aa095, 0.5);
    for (const bounds of this.layout.dragonControls) {
      this.slots.strokeRoundedRect(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        Math.max(3, bounds.height * 0.18),
      );
    }

    this.layout.freeCells.forEach((point, index) => {
      const label = this.slotLabels[index];
      label?.setPosition(
        point.x + this.layout.cardWidth / 2,
        point.y + this.layout.cardHeight / 2,
      ).setFontSize(Math.max(8, this.layout.cardWidth * 0.105)).setAlpha(0.62);
    });
    foundationSlots.forEach((point, index) => {
      const label = this.slotLabels[3 + index];
      label?.setPosition(
        point.x + this.layout.cardWidth / 2,
        point.y + this.layout.cardHeight / 2,
      ).setFontSize(Math.max(8, this.layout.cardWidth * 0.12)).setAlpha(0.72);
    });
    this.layout.dragonControls.forEach((bounds, index) => {
      const label = this.slotLabels[7 + index];
      label?.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        .setFontSize(Math.max(8, bounds.height * 0.34))
        .setAlpha(0.78);
    });
  }

  private updateDealStack(): void {
    const offsets = this.dealStackVisual.getLayerOffsets(this.layout.profile);
    this.dealStack.clear();
    this.dealStack.setVisible(offsets.length > 0);
    if (offsets.length === 0) return;

    const width = this.layout.cardWidth;
    const height = this.layout.cardHeight;

    offsets.forEach((offset, index) => {
      const top = index === offsets.length - 1;
      drawSchematicCardBack(
        this.dealStack,
        this.layout.dealOrigin.x,
        this.layout.dealOrigin.y + offset,
        width,
        height,
        !top,
      );
    });
  }

  private calculatePlacements(): Map<CardId, CardPlacement> {
    const placements = new Map<CardId, CardPlacement>();
    const state = this.game.state;

    state.tableau.forEach((column, columnIndex) => {
      column.forEach((cardId, index) => placements.set(cardId, {
        x: this.layout.tableauX[columnIndex],
        y: tableauCardY(this.layout, column.length, index),
        depth: 100 + columnIndex * 30 + index,
        source: { zone: 'tableau', column: columnIndex, index },
      }));
    });

    state.freeCells.forEach((cell, cellIndex) => {
      if (cell.kind !== 'card') return;
      const point = this.layout.freeCells[cellIndex];
      placements.set(cell.cardId, {
        x: point.x,
        y: point.y,
        depth: 500 + cellIndex,
        source: { zone: 'free-cell', cell: cellIndex },
      });
    });

    const suits = ['coins', 'bamboo', 'characters'] as const;
    suits.forEach((suit, suitIndex) => {
      state.foundations[suit].forEach((cardId, index) => {
        const point = this.layout.foundations[suitIndex];
        placements.set(cardId, { x: point.x, y: point.y, depth: 700 + suitIndex * 20 + index, source: null });
      });
    });
    if (state.flowerFoundation) {
      placements.set(state.flowerFoundation, {
        x: this.layout.flowerFoundation.x,
        y: this.layout.flowerFoundation.y,
        depth: 780,
        source: null,
      });
    }
    return placements;
  }

  private syncVisibility(visible: boolean): void {
    for (const view of this.cards.values()) view.setVisible(visible);
  }

  private syncToState(): void {
    const placements = this.calculatePlacements();
    for (const [cardId, view] of this.cards) {
      const placement = placements.get(cardId);
      view.setVisible(placement !== undefined);
      if (!placement) continue;
      view.setFaceDown(false);
      view.setPosition(placement.x, placement.y);
      view.setDepth(placement.depth);
    }
  }

  private pointForLocation(location: CardLocation): CardPlacement | null {
    if (location.zone === 'tableau') {
      const column = this.game.state.tableau[location.column] ?? [];
      const count = Math.max(column.length, location.index + 1);
      return {
        x: this.layout.tableauX[location.column],
        y: tableauCardY(this.layout, count, location.index),
        depth: 100 + location.column * 30 + location.index,
        source: null,
      };
    }
    if (location.zone === 'free-cell') {
      const point = this.layout.freeCells[location.cell];
      return point ? { x: point.x, y: point.y, depth: 500 + location.cell, source: null } : null;
    }
    if (location.zone === 'foundation') {
      const index = location.suit === 'coins' ? 0 : location.suit === 'bamboo' ? 1 : 2;
      const point = this.layout.foundations[index];
      return point ? { x: point.x, y: point.y, depth: 700 + index * 20 + location.index, source: null } : null;
    }
    if (location.zone === 'flower-foundation') {
      return { x: this.layout.flowerFoundation.x, y: this.layout.flowerFoundation.y, depth: 780, source: null };
    }
    const point = this.layout.freeCells[location.cell];
    return point ? { x: point.x, y: point.y, depth: 760 + location.cell, source: null } : null;
  }

  private playOperationList(
    operations: readonly CardOperation[],
    onComplete: () => void,
    forceKind?: 'player' | 'undo' | 'foundation',
    explicitDuration?: number,
  ): void {
    const run = (index: number): void => {
      const operation = operations[index];
      if (!operation) {
        onComplete();
        return;
      }
      const target = this.pointForLocation(operation.to);
      if (!target) {
        run(index + 1);
        return;
      }
      const kind = forceKind ?? (operation.reason === 'auto' ? 'foundation' : operation.reason === 'dragon' ? 'player' : 'player');
      const duration = explicitDuration ?? getCardMotionDuration(kind);
      this.animateCard(operation.cardId, target, duration, () => run(index + 1));
    };
    run(0);
  }

  private animateCard(
    cardId: CardId,
    placement: CardPlacement,
    duration: number,
    onComplete: () => void,
  ): void {
    const view = this.cards.get(cardId);
    if (!view) {
      onComplete();
      return;
    }
    const start = { x: view.input.x, y: view.input.y };
    const end = { x: placement.x, y: placement.y };
    const changed = start.x !== end.x || start.y !== end.y;
    const depth = getCardDepthTransition(view.input.depth, placement.depth, true, changed);
    view.setVisible(true);
    view.setDepth(depth.active);
    let tween: Phaser.Tweens.Tween;
    tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: (activeTween: Phaser.Tweens.Tween) => {
        const point = getCardFlightPoint(start, end, activeTween.getValue() ?? 1);
        view.setPosition(point.x, point.y);
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        view.setPosition(end.x, end.y);
        view.setDepth(depth.resting);
        onComplete();
      },
    });
    this.activeTweens.add(tween);
  }

  private isCommittedAtTarget(cardId: CardId, x: number, y: number): boolean {
    const placement = this.calculatePlacements().get(cardId);
    if (!placement) return false;
    return isCommittedCardDrop(
      { x, y, width: this.layout.cardWidth, height: this.layout.cardHeight },
      { x: placement.x, y: placement.y, width: this.layout.cardWidth, height: this.layout.cardHeight },
    );
  }

  private cancelAnimations(): void {
    this.dragState = null;
    for (const timer of this.activeTimers) timer.remove(false);
    this.activeTimers.clear();
    for (const tween of this.activeTweens) tween.stop();
    this.activeTweens.clear();
    // The GameScene supplies dragDistanceThreshold; relayout intentionally reads the same input object.
    void this.dragDistanceThreshold;
    void this.isCommittedAtTarget;
  }
}
