import Phaser from 'phaser';
import { canCollectDragons } from '../model/TrifoldRules.ts';
import type { DragonFamily } from '../model/types.ts';
import { HintWorkerClient } from '../hints/HintWorkerClient.ts';
import { HintCoordinator } from '../../meta/hints/HintCoordinator.ts';
import { TrifoldBoardView } from '../view/TrifoldBoardView.ts';
import {
  calculateViewportLayout,
  scaleViewportLayout,
  type LayoutBounds,
  type SafeAreaInsets,
  type ViewportLayout,
} from '../view/ViewportLayout.ts';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import type { StandardDifficulty } from '../../meta/profile/ProfileTypes.ts';
import {
  StandardSessionController,
  type StandardSessionViewState,
} from '../../meta/standard/StandardSessionController.ts';
import type { StandardWinSettlementResult } from '../../meta/standard/StandardWinSettlement.ts';
import { DailySessionController, type DailySessionViewState } from '../../meta/daily/DailySessionController.ts';
import type { DailyWinSettlementResult } from '../../meta/daily/DailyWinSettlement.ts';
import { toLocalDateKey } from '../../meta/daily/DailyDate.ts';
import { buildStandardWinViewModel, type StandardWinViewModel } from '../../ui/win/StandardWinViewModel.ts';
import { claimRewardDouble, createRewardDoubleOffer, type RewardDoubleOffer } from '../../meta/economy/RewardDouble.ts';
import { WinOverlay, buildStandardWinOverlayContent } from '../../ui/win/WinOverlay.ts';
import { SFX_ASSETS, SfxController } from '../../settings/SfxController.ts';
import { GameHud } from '../../ui/game/GameHud.ts';
import { buildGameHudViewModel } from '../../ui/game/GameHudViewModel.ts';
import { buildDailyWinOverlayContent } from '../../ui/daily/DailyViewModel.ts';
import { GameplayActivity } from '../../platform/GameplayActivity.ts';
import { TutorialController } from '../../tutorial/TutorialController.ts';
import { tutorialText } from '../../tutorial/TutorialText.ts';
import { tr } from '../../i18n/Localization.ts';

type ControlVariant = 'default' | 'dragon';
type StandardLaunchMode = 'new-standard' | 'resume-standard' | 'tutorial';
type DailyLaunchMode = 'new-daily' | 'resume-daily';
type GameLaunchMode = StandardLaunchMode | DailyLaunchMode;
type ActiveSession = StandardSessionController | DailySessionController;

interface GameSceneLaunchData {
  readonly mode?: GameLaunchMode;
  readonly difficulty?: StandardDifficulty;
  readonly dailyDateKey?: string;
}

interface SceneControl {
  readonly zone: Phaser.GameObjects.Zone;
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly text: string;
  readonly variant: ControlVariant;
  enabled: boolean;
  completed: boolean;
  hinted: boolean;
  tutorialHinted: boolean;
}

const DRAGONS: readonly DragonFamily[] = ['red', 'green', 'white'];
const DRAGON_LABELS: Readonly<Record<DragonFamily, string>> = {
  red: 'RD',
  green: 'GD',
  white: 'BD',
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

function randomVerifiedIndex(size: number): number {
  if (!Number.isSafeInteger(size) || size < 1) throw new RangeError('Verified deal pool must be non-empty.');
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) % size;
}

function parseLaunchData(raw: unknown): GameSceneLaunchData {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = raw as Record<string, unknown>;
  const mode = value.mode === 'resume-standard' || value.mode === 'new-standard' || value.mode === 'tutorial'
    || value.mode === 'resume-daily' || value.mode === 'new-daily' ? value.mode : undefined;
  const difficulty = value.difficulty === 'easy' || value.difficulty === 'medium' || value.difficulty === 'hard'
    ? value.difficulty
    : undefined;
  const dailyDateKey = typeof value.dailyDateKey === 'string' ? value.dailyDateKey : undefined;
  return { mode, difficulty, dailyDateKey };
}


export class GameScene extends Phaser.Scene {
  private launchData: GameSceneLaunchData = {};
  private session: ActiveSession | null = null;
  private board: TrifoldBoardView | null = null;
  private sfx: SfxController | null = null;
  private readonly missingSfxKeys = new Set<string>();
  private currentLayout: ViewportLayout | null = null;
  private gameHud: GameHud | null = null;
  private currentCoins = 0;
  private readonly dragonControls = new Map<DragonFamily, SceneControl>();
  private boardReady = false;
  private victoryAnnounced = false;
  private victoryOverlay: WinOverlay | null = null;
  private blockingMessage: Phaser.GameObjects.Text | null = null;
  private sessionStarting = false;
  private rewardDoubleClaiming = false;
  private gameplayActivity: GameplayActivity | null = null;
  private platformPauseUnsubscribe: (() => void) | null = null;
  private hintWorker: HintWorkerClient | null = null;
  private hintCoordinator: HintCoordinator | null = null;
  private hintBusy = false;
  private tutorialController: TutorialController | null = null;
  private tutorialTextObject: Phaser.GameObjects.Text | null = null;
  private tutorialDragonFamily: DragonFamily | null = null;
  private sceneGeneration = 0;

  constructor() {
    super('GameScene');
  }

  init(data: unknown): void {
    this.launchData = parseLaunchData(data);
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
    const generation = ++this.sceneGeneration;
    this.sessionStarting = false;
    const runtime = getRuntimeServices();
    runtime.theme.setTheme(runtime.repository.current.activeThemeId);
    this.cameras.main.setBackgroundColor(runtime.theme.boardSurfaceColor);
    this.input.dragDistanceThreshold = 7;
    const sound = this.sound;
    this.sfx = new SfxController({
      get locked() { return sound.locked; },
      exists: (key) => !this.missingSfxKeys.has(key) && this.cache.audio.exists(key),
      play: (key, config) => this.sound.play(key, config),
    });
    this.sfx.setEnabled(runtime.repository.current.settings.sfxEnabled);

    this.createControls();
    this.gameplayActivity = new GameplayActivity(runtime.platform.gameplay);
    this.gameplayActivity.setDocumentVisible(document.visibilityState === 'visible');
    this.gameplayActivity.setPlatformPaused(runtime.platform.pause.isPaused());
    this.platformPauseUnsubscribe = runtime.platform.pause.subscribe((paused) => {
      this.gameplayActivity?.setPlatformPaused(paused);
      this.session?.setVisible(document.visibilityState === 'visible' && !paused);
    });
    this.scale.on('resize', this.handleResize, this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.events.on('service-overlay-closed', this.handleServiceOverlayClosed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.sceneGeneration === generation) this.sceneGeneration += 1;
      this.scale.off('resize', this.handleResize, this);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.events.off('service-overlay-closed', this.handleServiceOverlayClosed, this);
      this.platformPauseUnsubscribe?.();
      this.platformPauseUnsubscribe = null;
      this.gameplayActivity?.stop();
      this.gameplayActivity = null;
      this.session?.setVisible(false);
      void this.session?.flushPersistence();
      this.hintCoordinator?.clear();
      this.hintCoordinator = null;
      this.hintWorker?.dispose();
      this.hintWorker = null;
      this.tutorialController = null;
      this.tutorialTextObject?.destroy();
      this.tutorialTextObject = null;
      this.board?.destroy();
      this.destroyControls();
      this.session = null;
    });

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refreshHud() });
    void this.initializeSession(generation);
  }

  private isCurrentSceneGeneration(generation: number): boolean {
    return this.sceneGeneration === generation;
  }

  private async initializeSession(generation: number): Promise<void> {
    try {
      const services = getRuntimeServices();
      const mode = this.launchData.mode;
      if (mode === 'tutorial') {
        this.startTutorial();
        return;
      }
      if (mode === 'resume-daily') {
        await this.resumeDaily(generation);
        return;
      }
      if (mode === 'new-daily') {
        if (!this.launchData.dailyDateKey) throw new Error('Daily launch requires a date key.');
        await this.startNewDaily(this.launchData.dailyDateKey, generation);
        return;
      }
      if (mode === 'resume-standard' && services.repository.current.activeStandard) {
        const session = StandardSessionController.resume({ repository: services.repository, wallNow: this.platformWallNow });
        if (!this.isCurrentSceneGeneration(generation)) return;
        this.mountSession(session, false);
        return;
      }
      await this.startNewStandard(this.launchData.difficulty ?? services.repository.current.selectedStandardDifficulty, generation);
    } catch (error) {
      if (!this.isCurrentSceneGeneration(generation)) return;
      console.error('[Trifold] session failed to initialize', error);
      this.showBlockingConfiguration(tr(getRuntimeServices().language, 'error.openDeal'));
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

  private startTutorial(): void {
    const services = getRuntimeServices();
    const session = StandardSessionController.startTutorial({
      repository: services.repository,
      wallNow: this.platformWallNow,
    });
    this.mountSession(session, false, true);
    services.analytics.track('tutorial_start');
  }

  private async startNewStandard(difficulty?: StandardDifficulty, generation = this.sceneGeneration): Promise<void> {
    if (this.sessionStarting) return;
    this.sessionStarting = true;
    this.refreshControls();
    try {
      const services = getRuntimeServices();
      const replacingSavedStandard = services.repository.current.activeStandard !== null;
      const previous = this.session;
      if (previous) {
        previous.setVisible(false);
        await previous.flushPersistence();
        if (!this.isCurrentSceneGeneration(generation)) return;
      }
      const requestedDifficulty = difficulty ?? services.repository.current.selectedStandardDifficulty;
      const session = await StandardSessionController.startNew({
        repository: services.repository,
        catalog: services.catalog,
        requestedDifficulty,
        randomIndex: randomVerifiedIndex,
        wallNow: this.platformWallNow,
      });
      if (!this.isCurrentSceneGeneration(generation)) return;
      this.mountSession(session, true);
      if (replacingSavedStandard) services.analytics.track('standard_reset', { difficulty: requestedDifficulty });
      services.analytics.track('standard_start', {
        difficulty: session.viewState.difficulty,
        partition: session.viewState.partition,
        seed: session.viewState.seed,
      });
    } catch (error) {
      if (!this.isCurrentSceneGeneration(generation)) return;
      console.error('[Trifold] failed to start Standard deal', error);
      this.showBlockingConfiguration(tr(getRuntimeServices().language, 'error.newStandard'));
    } finally {
      if (this.sceneGeneration === generation) {
        this.sessionStarting = false;
        this.refreshControls();
      }
    }
  }


  private async startNewDaily(dailyDateKey: string, generation = this.sceneGeneration): Promise<void> {
    if (this.sessionStarting) return;
    this.sessionStarting = true;
    this.refreshControls();
    try {
      const services = getRuntimeServices();
      const previous = this.session;
      if (previous) {
        previous.setVisible(false);
        await previous.flushPersistence();
        if (!this.isCurrentSceneGeneration(generation)) return;
      }
      const todayKey = toLocalDateKey(new Date());
      const common = {
        repository: services.repository,
        catalog: services.catalog,
        todayKey,
        calendarDateKeyNow: () => toLocalDateKey(new Date()),
        wallNow: this.platformWallNow,
      } as const;
      const session = dailyDateKey === todayKey
        ? await DailySessionController.startToday(common)
        : await DailySessionController.startArchive({ ...common, dailyDateKey });
      if (!this.isCurrentSceneGeneration(generation)) return;
      this.mountSession(session, true);
      services.analytics.track('daily_start', {
        dateKey: session.viewState.dailyDateKey,
        kind: session.viewState.kind,
        seed: session.viewState.seed,
      });
    } catch (error) {
      if (!this.isCurrentSceneGeneration(generation)) return;
      console.error('[Trifold] failed to start Daily deal', error);
      this.showBlockingConfiguration(tr(getRuntimeServices().language, 'error.newDaily'));
    } finally {
      if (this.sceneGeneration === generation) {
        this.sessionStarting = false;
        this.refreshControls();
      }
    }
  }

  private async resumeDaily(generation = this.sceneGeneration): Promise<void> {
    const services = getRuntimeServices();
    const todayKey = toLocalDateKey(new Date());
    const session = await DailySessionController.resumeOrClearExpired({
      repository: services.repository,
      catalog: services.catalog,
      todayKey,
      calendarDateKeyNow: () => toLocalDateKey(new Date()),
      wallNow: this.platformWallNow,
    });
    if (!this.isCurrentSceneGeneration(generation)) return;
    this.mountSession(session, false);
  }

  private mountSession(session: ActiveSession, animateInitialDeal: boolean, tutorialMode = false): void {
    this.hideVictory();
    this.blockingMessage?.destroy();
    this.blockingMessage = null;
    this.boardReady = false;
    this.victoryAnnounced = false;
    this.session = session;
    const runtime = getRuntimeServices();
    this.hintCoordinator?.clear();
    this.hintCoordinator = null;
    this.hintWorker?.dispose();
    this.hintWorker = null;
    this.hintBusy = false;
    this.tutorialController = tutorialMode ? new TutorialController() : null;
    this.tutorialDragonFamily = null;
    this.tutorialTextObject?.destroy();
    this.tutorialTextObject = tutorialMode ? this.add.text(0, 0, '', {
      color: '#d9f3ea',
      backgroundColor: '#173d36',
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      align: 'center',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5, 1).setDepth(4800) : null;
    if (session instanceof StandardSessionController && this.tutorialController === null) {
      this.hintWorker = new HintWorkerClient();
      this.hintCoordinator = new HintCoordinator(session, this.hintWorker);
    }
    this.currentCoins = runtime.repository.current.coins;
    session.setVisible(document.visibilityState === 'visible' && !runtime.platform.pause.isPaused());
    this.gameplayActivity?.setBlockingOverlayOpen(false);
    this.gameplayActivity?.setBoardActive(!session.viewState.won);
    this.board?.destroy();
    this.gameHud?.destroy();
    this.gameHud = new GameHud(this, this.buildHudViewModel(session), {
      home: () => this.goHome(),
      newDeal: () => {
        if (this.tutorialController) this.startTutorial();
        else if (session instanceof DailySessionController) void this.startNewDaily(session.viewState.dailyDateKey);
        else void this.startNewStandard();
      },
      undo: () => this.requestUndo(),
      hint: () => { void this.requestHint(); },
      settings: () => this.openSettingsOverlay(),
    });

    const layout = this.calculateBackingLayout();
    this.currentLayout = layout;
    const board = new TrifoldBoardView(this, session, {
      perform: (command) => {
        const tutorial = this.tutorialController;
        if (tutorial && !tutorial.canPerform(command)) return null;
        const result = session.perform(command);
        if (result && tutorial) tutorial.recordTransaction(command, result);
        return result;
      },
      settleInitialAutoMoves: () => session.settleInitialAutoMoves(),
      undo: () => {
        const tutorial = this.tutorialController;
        if (tutorial && !tutorial.waitingForUndo) return null;
        const result = session.undo();
        if (result && tutorial) tutorial.recordUndo();
        return result;
      },
      sound: (cue) => this.sfx?.play(cue),
      settled: () => { void this.handleSettled(session); },
    }, layout, getRuntimeServices().theme);
    this.board = board;
    this.applyControlLayout(layout);
    this.refreshControls();
    if (animateInitialDeal) board.playInitialDeal();
    else board.showCurrentState();
  }

  private refreshTutorialGuidance(): void {
    const tutorial = this.tutorialController;
    if (!tutorial || !this.board) return;
    this.board.clearHint();
    this.tutorialDragonFamily = null;
    const command = tutorial.expectedCommand;
    if (command) {
      this.board.showTutorialHint(command);
      if (command.type === 'collect-dragons') this.tutorialDragonFamily = command.family;
    }
    for (const [family, control] of this.dragonControls) control.tutorialHinted = family === this.tutorialDragonFamily;
    this.tutorialTextObject?.setText(tutorialText(tutorial.lesson, tutorial.waitingForUndo, getRuntimeServices().language));
    if (this.currentLayout) {
      this.applyControlLayout(this.currentLayout);
      this.layoutTutorialOverlay(this.currentLayout);
    }
  }

  private layoutTutorialOverlay(layout: ViewportLayout): void {
    const text = this.tutorialTextObject;
    if (!text) return;
    const fontSize = Math.max(10, Math.min(16, layout.cardWidth * 0.14));
    text.setFontSize(fontSize)
      .setWordWrapWidth(Math.max(120, layout.boardBounds.width * 0.78))
      .setPosition(layout.boardBounds.x + layout.boardBounds.width / 2, Math.max(layout.boardBounds.y + fontSize + 4, layout.tableauY - 2));
  }

  private openSettingsOverlay(): void {
    const session = this.session;
    if (!session || this.scene.isActive('SettingsScene')) return;
    session.setBlockingOverlayOpen(true);
    this.board?.setUiPaused(true);
    this.gameplayActivity?.setBlockingOverlayOpen(true);
    this.scene.launch('SettingsScene', { returnScene: 'GameScene' });
    this.scene.pause();
  }

  private handleServiceOverlayClosed(): void {
    const session = this.session;
    if (!session) return;
    this.sfx?.setEnabled(getRuntimeServices().repository.current.settings.sfxEnabled);
    session.setBlockingOverlayOpen(false);
    this.board?.setUiPaused(false);
    this.gameplayActivity?.setBlockingOverlayOpen(false);
    this.refreshControls();
    this.refreshTutorialGuidance();
  }

  private requestUndo(): void {
    this.clearHintVisuals();
    this.board?.requestUndo();
  }

  private collectDragons(family: DragonFamily): void {
    this.clearHintVisuals();
    this.board?.collectDragons(family);
  }

  private async requestHint(): Promise<void> {
    const session = this.session;
    const coordinator = this.hintCoordinator;
    if (!(session instanceof StandardSessionController) || this.tutorialController !== null || !coordinator || this.hintBusy || !this.boardReady) return;
    const runtime = getRuntimeServices();

    this.hintBusy = true;
    this.clearHintVisuals();
    runtime.analytics.track('hint_attempt', { seed: session.viewState.seed, difficulty: session.viewState.difficulty });
    session.setBlockingOverlayOpen(true);
    this.board?.setUiPaused(true);
    this.gameplayActivity?.setBlockingOverlayOpen(true);
    this.refreshHud();
    try {
      const prepared = await coordinator.prepare();
      if (prepared.status !== 'ready') return;
      const command = await coordinator.revealPreparedHint();
      if (!command || this.session !== session) return;
      this.board?.showHint(command);
      this.setHintedDragonFamily(command.type === 'collect-dragons' ? command.family : null);
      runtime.analytics.track('hint_success', { seed: session.viewState.seed, difficulty: session.viewState.difficulty });
    } catch (error) {
      console.error('[Trifold] hint failed', error);
    } finally {
      session.setBlockingOverlayOpen(false);
      this.board?.setUiPaused(false);
      this.gameplayActivity?.setBlockingOverlayOpen(false);
      this.hintBusy = false;
      this.refreshControls();
    }
  }

  private clearHintVisuals(): void {
    this.board?.clearHint();
    this.setHintedDragonFamily(null);
  }

  private setHintedDragonFamily(family: DragonFamily | null): void {
    for (const [candidate, control] of this.dragonControls) control.hinted = candidate === family;
    if (this.currentLayout) this.applyControlLayout(this.currentLayout);
  }

  private async handleSettled(session: ActiveSession): Promise<void> {
    if (this.session !== session) return;
    this.boardReady = true;
    this.refreshTutorialGuidance();
    if (session.viewState.won && !this.victoryAnnounced) {
      this.victoryAnnounced = true;
      this.boardReady = false;
      this.sfx?.play('victory');
      this.board?.setUiPaused(true);
      session.setBlockingOverlayOpen(true);
      this.gameplayActivity?.setBoardActive(false);
      this.gameplayActivity?.setBlockingOverlayOpen(true);
      try {
        const runtime = getRuntimeServices();
        if (session instanceof DailySessionController) {
          const beforeBestStreak = runtime.repository.current.daily.bestStreak;
          const settlement = await session.settleWin();
          this.currentCoins = settlement.profile.coins;
          const event = session.viewState.kind === 'archive' ? 'daily_archive_win' : 'daily_win';
          runtime.analytics.track(event, {
            dateKey: session.viewState.dailyDateKey,
            moves: session.viewState.moves,
            activeMs: session.viewState.activeMs,
            firstCompletion: settlement.firstCompletion,
          });
          if (settlement.completedOnTime && settlement.firstCompletion) {
            runtime.analytics.track('streak_changed', { bestStreak: settlement.profile.daily.bestStreak });
          }
          if (settlement.profile.daily.bestStreak !== beforeBestStreak && !settlement.completedOnTime) {
            runtime.analytics.track('streak_changed', { bestStreak: settlement.profile.daily.bestStreak });
          }
          if (settlement.rankAdvancedTo) runtime.analytics.track('mastery_rank_up', { rank: settlement.rankAdvancedTo });
          void runtime.leaderboards.syncFromProfile(settlement.profile, toLocalDateKey(new Date()), runtime.catalog);
          if (this.session === session) this.showDailyVictory(settlement, session.viewState);
        } else {
          let settlement = await session.settleWin();
          if (this.tutorialController?.recordWin()) {
            const completedProfile = await runtime.repository.mutate((profile) => ({ ...profile, tutorialCompleted: true }));
            settlement = { ...settlement, profile: completedProfile };
            runtime.analytics.track('tutorial_complete');
          }
          this.currentCoins = settlement.profile.coins;
          runtime.analytics.track('standard_win', {
            difficulty: session.viewState.difficulty,
            partition: session.viewState.partition,
            moves: session.viewState.moves,
            activeMs: session.viewState.activeMs,
            assisted: session.viewState.assisted,
            firstCompletion: settlement.firstCompletion,
          });
          if (settlement.rankAdvancedTo) runtime.analytics.track('mastery_rank_up', { rank: settlement.rankAdvancedTo });
          void runtime.leaderboards.syncFromProfile(settlement.profile, toLocalDateKey(new Date()), runtime.catalog);
          if (this.session === session) this.showVictory(settlement, session.viewState);
        }
      } catch (error) {
        console.error('[Trifold] failed to settle win', error);
        this.showBlockingConfiguration(tr(getRuntimeServices().language, 'error.saveWin'));
      }
    }
    this.refreshControls();
  }

  private handleVisibilityChange = (): void => {
    const visible = document.visibilityState === 'visible';
    const paused = getRuntimeServices().platform.pause.isPaused();
    this.gameplayActivity?.setDocumentVisible(visible);
    this.session?.setVisible(visible && !paused);
  };

  private platformWallNow = (): number => getRuntimeServices().platform.clock.nowMs() ?? Date.now();

  private handleResize(): void {
    this.clearHintVisuals();
    const layout = this.calculateBackingLayout();
    this.currentLayout = layout;
    const board = this.board;
    if (board) board.relayout(layout);
    this.applyControlLayout(layout);
    this.layoutVictory(layout);
    this.layoutTutorialOverlay(layout);
    this.refreshTutorialGuidance();
    if (this.blockingMessage) {
      this.blockingMessage.setPosition(layout.viewportWidth / 2, layout.viewportHeight / 2);
    }
  }

  private createControls(): void {
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
    const control: SceneControl = { zone, graphics, label, text, variant, enabled: true, completed: false, hinted: false, tutorialHinted: false };
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
    const lineColor = control.tutorialHinted
      ? 0x79c8b5
      : control.hinted
        ? 0xffef92
        : dragon
        ? (control.completed ? 0x70633a : control.enabled ? 0xf0d778 : 0xb49a4b)
        : 0x91ad9f;
    const fillAlpha = dragon
      ? (control.completed ? 0.62 : control.enabled ? 0.98 : 0.72)
      : (control.enabled ? 0.95 : 0.45);
    const lineAlpha = dragon
      ? (control.completed ? 0.5 : control.enabled ? 1 : 0.72)
      : (control.enabled ? 0.9 : 0.35);
    control.graphics.fillStyle(fillColor, fillAlpha);
    control.graphics.lineStyle(Math.max(1, bounds.height * ((control.hinted || control.tutorialHinted) ? 0.07 : 0.04)), lineColor, (control.hinted || control.tutorialHinted) ? 1 : lineAlpha);
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
    this.gameHud?.layout(layout);
    DRAGONS.forEach((family, index) => {
      const bounds = layout.dragonControls[index];
      if (bounds) this.layoutControl(this.dragonControls.get(family) ?? null, bounds);
    });
    this.layoutTutorialOverlay(layout);
  }

  private refreshControls(): void {
    const session = this.session;
    this.refreshHud();
    for (const family of DRAGONS) {
      const control = this.dragonControls.get(family);
      if (!control) continue;
      const completed = session?.state.freeCells.some(
        (cell) => cell.kind === 'dragons' && cell.family === family,
      ) === true;
      control.completed = completed;
      control.enabled = !completed
        && this.boardReady
        && session !== null
        && canCollectDragons(session.state, family) !== null;
    }
    if (this.currentLayout) this.applyControlLayout(this.currentLayout);
  }

  private buildHudViewModel(session: ActiveSession) {
    const language = getRuntimeServices().language;
    if (session instanceof DailySessionController) {
      const state = session.viewState;
      return buildGameHudViewModel({
        modeLabel: 'Daily',
        moves: state.moves,
        activeMs: state.activeMs,
        assisted: false,
        canUndo: this.boardReady && session.canUndo,
        coins: this.currentCoins,
        hintEligible: false,
      }, language);
    }
    const state = session.viewState;
    return buildGameHudViewModel({
      difficulty: state.difficulty,
      moves: state.moves,
      activeMs: state.activeMs,
      assisted: state.assisted,
      canUndo: this.boardReady && session.canUndo,
      coins: this.currentCoins,
      hintEligible: this.tutorialController === null
        && this.boardReady
        && !state.won
        && !this.hintBusy
        && this.hintCoordinator !== null
        && !this.hintCoordinator.isUnavailableForCurrentState(),
    }, language);
  }

  private refreshHud(): void {
    const session = this.session;
    if (!session || !this.gameHud) return;
    this.gameHud.setState(this.buildHudViewModel(session));
  }

  private goHome(): void {
    this.clearHintVisuals();
    this.session?.setVisible(false);
    void this.session?.flushPersistence();
    this.scene.start('HomeScene');
  }

  private showVictory(
    settlement: StandardWinSettlementResult,
    viewState: StandardSessionViewState,
  ): void {
    this.hideVictory();
    const services = getRuntimeServices();
    const viewModel = buildStandardWinViewModel(settlement, viewState, services.language);
    const offer = createRewardDoubleOffer({
      seed: viewState.seed,
      difficulty: viewState.difficulty,
      baseCoinsGranted: settlement.baseCoinsGranted,
      firstCompletion: settlement.firstCompletion,
    });
    const canDouble = offer !== null && services.rewardedAds.available;
    const baseContent = buildStandardWinOverlayContent(viewModel, services.language);
    this.victoryOverlay = new WinOverlay(
      this,
      {
        ...baseContent,
        rewardActionLabel: canDouble ? tr(services.language, 'win.doubleCoins') : null,
        rewardActionEnabled: canDouble,
      },
      {
        newDeal: () => { void this.startNewStandard(); },
        home: () => this.goHome(),
        ...(canDouble && offer ? { doubleCoins: () => { void this.claimStandardRewardDouble(offer, viewModel, viewState.seed); } } : {}),
      },
    );
    if (this.currentLayout) this.victoryOverlay.layout(this.currentLayout);
  }

  private async claimStandardRewardDouble(offer: RewardDoubleOffer, viewModel: StandardWinViewModel, seed: number): Promise<void> {
    if (this.rewardDoubleClaiming) return;
    const services = getRuntimeServices();
    if (!services.rewardedAds.available || !this.victoryOverlay) return;
    const overlay = this.victoryOverlay;
    const idleContent = buildStandardWinOverlayContent(viewModel, services.language);
    this.rewardDoubleClaiming = true;
    services.analytics.track('reward_double_attempt', { seed, bonusCoins: offer.bonusCoins });
    overlay.setContent({ ...idleContent, rewardActionLabel: tr(services.language, 'common.loading'), rewardActionEnabled: false });
    if (this.currentLayout) overlay.layout(this.currentLayout);
    try {
      const rewarded = await services.rewardedAds.showRewarded();
      if (!rewarded) {
        if (this.victoryOverlay === overlay) {
          overlay.setContent({ ...idleContent, rewardActionLabel: tr(services.language, 'win.doubleCoins'), rewardActionEnabled: true });
        }
        return;
      }
      const profile = await services.repository.mutate((current) => claimRewardDouble(current, offer));
      services.analytics.track('reward_double_success', { seed, bonusCoins: offer.bonusCoins });
      this.currentCoins = profile.coins;
      this.refreshHud();
      if (this.victoryOverlay === overlay) {
        const rewardLine = [idleContent.rewardLine, tr(services.language, 'common.bonusAd', { count: offer.bonusCoins })].filter(Boolean).join(' · ');
        overlay.setContent({ ...idleContent, rewardLine, rewardActionLabel: null, rewardActionEnabled: false });
      }
    } catch (error) {
      console.error('[Trifold] rewarded double failed', error);
      if (this.victoryOverlay === overlay) {
        overlay.setContent({ ...idleContent, rewardActionLabel: tr(services.language, 'win.doubleCoins'), rewardActionEnabled: true });
      }
    } finally {
      this.rewardDoubleClaiming = false;
      if (this.victoryOverlay === overlay && this.currentLayout) overlay.layout(this.currentLayout);
    }
  }


  private showDailyVictory(
    settlement: DailyWinSettlementResult,
    viewState: DailySessionViewState,
  ): void {
    this.hideVictory();
    const todayKey = toLocalDateKey(new Date());
    this.victoryOverlay = new WinOverlay(
      this,
      buildDailyWinOverlayContent(settlement, viewState, todayKey, getRuntimeServices().language),
      {
        newDeal: () => { void this.startNewDaily(viewState.dailyDateKey); },
        home: () => this.goHome(),
      },
    );
    if (this.currentLayout) this.victoryOverlay.layout(this.currentLayout);
  }

  private layoutVictory(layout: ViewportLayout): void {
    this.victoryOverlay?.layout(layout);
  }

  private hideVictory(): void {
    this.victoryOverlay?.destroy();
    this.victoryOverlay = null;
    this.gameplayActivity?.setBlockingOverlayOpen(false);
  }

  private showBlockingConfiguration(message: string): void {
    this.gameplayActivity?.setBoardActive(false);
    this.gameplayActivity?.setBlockingOverlayOpen(true);
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
    for (const control of this.dragonControls.values()) {
      control.zone.destroy();
      control.graphics.destroy();
      control.label.destroy();
    }
    this.gameHud?.destroy();
    this.gameHud = null;
    this.dragonControls.clear();
    this.tutorialTextObject?.destroy();
    this.tutorialTextObject = null;
    this.hideVictory();
  }
}
