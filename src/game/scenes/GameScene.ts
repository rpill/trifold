import Phaser from 'phaser';
import { createDeal } from '../model/deal.ts';
import {
  DevelopmentDealSource,
  VerifiedCatalogDealSource,
  type DealSource,
} from '../model/DealSource.ts';
import { TrifoldGame } from '../model/TrifoldGame.ts';
import { canCollectDragons, isWon } from '../model/TrifoldRules.ts';
import { VerifiedDealCatalog } from '../model/VerifiedDealCatalog.ts';
import type { DragonFamily } from '../model/types.ts';
import { TrifoldBoardView } from '../view/TrifoldBoardView.ts';
import {
  calculateViewportLayout,
  scaleViewportLayout,
  type LayoutBounds,
  type SafeAreaInsets,
  type ViewportLayout,
} from '../view/ViewportLayout.ts';
import { SFX_ASSETS, SfxController } from '../../settings/SfxController.ts';

interface InjectedVerifiedDeals {
  readonly buffer: ArrayBuffer;
  readonly manifest: unknown;
}

declare global {
  interface Window {
    __TRIFOLD_VERIFIED_DEALS__?: InjectedVerifiedDeals;
  }
}

type ControlVariant = 'default' | 'dragon';

interface SceneControl {
  readonly zone: Phaser.GameObjects.Zone;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly text: string;
  readonly variant: ControlVariant;
  enabled: boolean;
  completed: boolean;
}

const DRAGONS: readonly DragonFamily[] = ['red', 'green', 'white'];
const DRAGON_LABELS: Readonly<Record<DragonFamily, string>> = {
  red: 'RD',
  green: 'GD',
  white: 'WD',
};

function readCssPixels(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readSafeAreaInsets(): SafeAreaInsets {
  return {
    top: readCssPixels('--safe-area-top'),
    right: readCssPixels('--safe-area-right'),
    bottom: readCssPixels('--safe-area-bottom'),
    left: readCssPixels('--safe-area-left'),
  };
}

export class GameScene extends Phaser.Scene {
  private gameModel: TrifoldGame | null = null;
  private board: TrifoldBoardView | null = null;
  private dealSource: DealSource | null = null;
  private currentSeed: number | undefined;
  private sfx: SfxController | null = null;
  private readonly missingSfxKeys = new Set<string>();
  private currentLayout: ViewportLayout | null = null;
  private newDealControl: SceneControl | null = null;
  private undoControl: SceneControl | null = null;
  private readonly dragonControls = new Map<DragonFamily, SceneControl>();
  private boardReady = false;
  private victoryAnnounced = false;
  private victoryOverlay: Phaser.GameObjects.Container | null = null;
  private blockingMessage: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      const key = String(file.key);
      if (key.startsWith('sfx-')) {
        this.missingSfxKeys.add(key);
        console.warn(`[Trifold] optional SFX unavailable: ${key}`);
      }
    });

    for (const asset of Object.values(SFX_ASSETS)) {
      asset.keys.forEach((key, index) => {
        const url = asset.urls[index];
        if (url) this.load.audio(key, url);
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x183f2f);
    this.input.dragDistanceThreshold = 7;
    const sound = this.sound;
    this.sfx = new SfxController({
      get locked() { return sound.locked; },
      exists: (key) => !this.missingSfxKeys.has(key) && this.cache.audio.exists(key),
      play: (key, config) => this.sound.play(key, config),
    });

    this.dealSource = this.resolveDealSource();
    if (!this.dealSource) {
      this.showBlockingConfiguration('Verified deal catalog unavailable');
      return;
    }

    this.createControls();
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.board?.destroy();
      this.destroyControls();
    });

    this.startNewDeal();
  }

  private resolveDealSource(): DealSource | null {
    if (import.meta.env.DEV) return new DevelopmentDealSource(1);

    const injected = window.__TRIFOLD_VERIFIED_DEALS__;
    if (!injected) return null;
    try {
      const catalog = VerifiedDealCatalog.decode(injected.buffer, injected.manifest);
      return new VerifiedCatalogDealSource(catalog);
    } catch (error) {
      console.error('[Trifold] verified deal catalog rejected', error);
      return null;
    }
  }

  private calculateBackingLayout(): ViewportLayout {
    const cssZoom = this.scale.zoom;
    const safeCssZoom = cssZoom > 0 ? cssZoom : 1;
    const renderScale = 1 / safeCssZoom;
    const logicalWidth = this.scale.width / renderScale;
    const logicalHeight = this.scale.height / renderScale;
    const logical = calculateViewportLayout(logicalWidth, logicalHeight, readSafeAreaInsets());
    const layout = scaleViewportLayout(logical, renderScale);
    this.cameras.main.setSize(this.scale.width, this.scale.height).setZoom(1);
    return layout;
  }

  private startNewDeal(): void {
    if (!this.dealSource) return;
    this.hideVictory();
    this.blockingMessage?.destroy();
    this.blockingMessage = null;
    this.boardReady = false;
    this.victoryAnnounced = false;

    const seed = this.dealSource.nextSeed(this.currentSeed);
    this.currentSeed = seed;
    const game = new TrifoldGame(createDeal(seed));
    this.gameModel = game;
    this.board?.destroy();

    const layout = this.calculateBackingLayout();
    this.currentLayout = layout;
    const board = new TrifoldBoardView(this, game, {
      perform: (command) => game.perform(command),
      settleInitialAutoMoves: () => game.settleInitialAutoMoves(),
      undo: () => game.undo(),
      sound: (cue) => this.sfx?.play(cue),
      settled: () => this.handleSettled(game),
    }, layout);
    this.board = board;
    this.applyControlLayout(layout);
    this.refreshControls();
    board.playInitialDeal();
  }

  private requestUndo(): void {
    this.board?.requestUndo();
  }

  private collectDragons(family: DragonFamily): void {
    this.board?.collectDragons(family);
  }

  private handleSettled(game: TrifoldGame): void {
    if (this.gameModel !== game) return;
    this.boardReady = true;
    if (isWon(game.state) && !this.victoryAnnounced) {
      this.victoryAnnounced = true;
      this.boardReady = false;
      this.sfx?.play('victory');
      this.board?.setUiPaused(true);
      this.showVictory();
    }
    this.refreshControls();
  }

  private handleResize(): void {
    const layout = this.calculateBackingLayout();
    this.currentLayout = layout;
    const board = this.board;
    if (board) board.relayout(layout);
    this.applyControlLayout(layout);
    this.layoutVictory(layout);
    if (this.blockingMessage) {
      this.blockingMessage.setPosition(layout.viewportWidth / 2, layout.viewportHeight / 2);
    }
  }

  private createControls(): void {
    this.newDealControl = this.createControl('Новая раздача', () => this.startNewDeal());
    this.undoControl = this.createControl('Отмена', () => this.requestUndo());
    for (const family of DRAGONS) {
      this.dragonControls.set(
        family,
        this.createControl(DRAGON_LABELS[family], () => this.collectDragons(family), false, 'dragon'),
      );
    }
  }

  private createControl(
    text: string,
    action: () => void,
    playButtonSound = true,
    variant: ControlVariant = 'default',
  ): SceneControl {
    const graphics = this.add.graphics().setDepth(2000);
    const zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setDepth(2002);
    const label = this.add.text(0, 0, text, {
      color: '#edf5f0',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(2001);
    const control: SceneControl = { zone, graphics, label, text, variant, enabled: true, completed: false };
    zone.on('pointerdown', () => {
      if (!control.enabled) return;
      if (playButtonSound) this.sfx?.play('button');
      action();
    });
    return control;
  }

  private layoutControl(control: SceneControl | null, bounds: LayoutBounds): void {
    if (!control) return;
    control.graphics.clear();
    const dragon = control.variant === 'dragon';
    const fillColor = dragon
      ? (control.completed ? 0x4f4524 : control.enabled ? 0xd7b84d : 0x8b7430)
      : 0x264b3b;
    const lineColor = dragon
      ? (control.completed ? 0x70633a : control.enabled ? 0xf0d778 : 0xb49a4b)
      : 0x91ad9f;
    const fillAlpha = dragon
      ? (control.completed ? 0.62 : control.enabled ? 0.98 : 0.72)
      : (control.enabled ? 0.95 : 0.45);
    const lineAlpha = dragon
      ? (control.completed ? 0.5 : control.enabled ? 1 : 0.72)
      : (control.enabled ? 0.9 : 0.35);
    control.graphics.fillStyle(fillColor, fillAlpha);
    control.graphics.lineStyle(Math.max(1, bounds.height * 0.04), lineColor, lineAlpha);
    control.graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.18));
    control.graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, Math.max(4, bounds.height * 0.18));
    control.label.setPosition(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    control.label.setFontSize(Math.max(9, Math.min(bounds.height * 0.34, bounds.width / Math.max(3, control.text.length * 0.58))));
    control.label.setColor(
      dragon
        ? (control.completed ? '#8f845e' : control.enabled ? '#30270d' : '#d8c987')
        : '#edf5f0',
    );
    control.label.setAlpha(dragon ? (control.completed ? 0.82 : 1) : (control.enabled ? 1 : 0.45));
    control.zone.setPosition(bounds.x, bounds.y).setSize(bounds.width, bounds.height);
    if (control.enabled) {
      control.zone.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, bounds.width, bounds.height),
        Phaser.Geom.Rectangle.Contains,
      );
    } else {
      control.zone.disableInteractive();
    }
  }

  private applyControlLayout(layout: ViewportLayout): void {
    this.layoutControl(this.newDealControl, layout.newDealControl);
    this.layoutControl(this.undoControl, layout.undoControl);
    DRAGONS.forEach((family, index) => {
      const bounds = layout.dragonControls[index];
      if (bounds) this.layoutControl(this.dragonControls.get(family) ?? null, bounds);
    });
  }

  private refreshControls(): void {
    const game = this.gameModel;
    if (this.newDealControl) this.newDealControl.enabled = true;
    if (this.undoControl) this.undoControl.enabled = this.boardReady && game?.canUndo === true;
    for (const family of DRAGONS) {
      const control = this.dragonControls.get(family);
      if (!control) continue;
      const completed = game?.state.freeCells.some(
        (cell) => cell.kind === 'dragons' && cell.family === family,
      ) === true;
      control.completed = completed;
      control.enabled = !completed
        && this.boardReady
        && game !== null
        && canCollectDragons(game.state, family) !== null;
    }
    if (this.currentLayout) this.applyControlLayout(this.currentLayout);
  }

  private showVictory(): void {
    this.hideVictory();
    const background = this.add.rectangle(0, 0, 1, 1, 0x10261e, 0.94).setOrigin(0.5);
    const title = this.add.text(0, 0, 'Победа', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const next = this.add.text(0, 0, 'Новая раздача', {
      color: '#dcebe3',
      backgroundColor: '#2b5a45',
      padding: { x: 16, y: 10 },
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    next.on('pointerdown', () => this.startNewDeal());
    this.victoryOverlay = this.add.container(0, 0, [background, title, next]).setDepth(5000);
    if (this.currentLayout) this.layoutVictory(this.currentLayout);
  }

  private layoutVictory(layout: ViewportLayout): void {
    if (!this.victoryOverlay) return;
    const [background, title, next] = this.victoryOverlay.list as [
      Phaser.GameObjects.Rectangle,
      Phaser.GameObjects.Text,
      Phaser.GameObjects.Text,
    ];
    const width = Math.min(layout.viewportWidth * 0.42, layout.cardWidth * 4.4);
    const height = Math.min(layout.viewportHeight * 0.42, layout.cardHeight * 2.1);
    this.victoryOverlay.setPosition(layout.viewportWidth / 2, layout.viewportHeight / 2);
    background.setDisplaySize(width, height);
    title.setPosition(0, -height * 0.18).setFontSize(Math.max(20, height * 0.2));
    next.setPosition(0, height * 0.2).setFontSize(Math.max(12, height * 0.11));
  }

  private hideVictory(): void {
    this.victoryOverlay?.destroy(true);
    this.victoryOverlay = null;
  }

  private showBlockingConfiguration(message: string): void {
    const layout = this.calculateBackingLayout();
    this.currentLayout = layout;
    this.blockingMessage?.destroy();
    this.blockingMessage = this.add.text(layout.viewportWidth / 2, layout.viewportHeight / 2, message, {
      color: '#ffffff',
      backgroundColor: '#622f36',
      padding: { x: 16, y: 12 },
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${Math.max(16, layout.cardWidth * 0.16)}px`,
    }).setOrigin(0.5).setDepth(6000);
  }

  private destroyControls(): void {
    const controls = [this.newDealControl, this.undoControl, ...this.dragonControls.values()];
    for (const control of controls) {
      if (!control) continue;
      control.zone.destroy();
      control.graphics.destroy();
      control.label.destroy();
    }
    this.newDealControl = null;
    this.undoControl = null;
    this.dragonControls.clear();
    this.hideVictory();
  }
}
