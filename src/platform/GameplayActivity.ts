import type { GameplayMarkup } from './services.ts';

export class GameplayActivity {
  private readonly markup: GameplayMarkup;
  private boardActive = false;
  private documentVisible = true;
  private blockingOverlayOpen = false;
  private platformPaused = false;
  private signaledRunning = false;

  constructor(markup: GameplayMarkup) {
    this.markup = markup;
  }

  setBoardActive(active: boolean): void {
    this.boardActive = active;
    this.sync();
  }

  setDocumentVisible(visible: boolean): void {
    this.documentVisible = visible;
    this.sync();
  }

  setBlockingOverlayOpen(open: boolean): void {
    this.blockingOverlayOpen = open;
    this.sync();
  }

  setPlatformPaused(paused: boolean): void {
    this.platformPaused = paused;
    this.sync();
  }

  stop(): void {
    this.boardActive = false;
    this.sync();
  }

  private sync(): void {
    const shouldRun = this.boardActive
      && this.documentVisible
      && !this.blockingOverlayOpen
      && !this.platformPaused;
    if (shouldRun === this.signaledRunning) return;
    this.signaledRunning = shouldRun;
    if (shouldRun) this.markup.start();
    else this.markup.stop();
  }
}
