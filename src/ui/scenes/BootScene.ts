import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import { preloadCardFaceAssets } from '../../game/view/CardFaceAssets.ts';
import { preloadUiAssets } from '../assets/UiAssets.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    preloadUiAssets(this);
    preloadCardFaceAssets(this);
  }

  create(): void {
    if (getRuntimeServices().repository.current.tutorialCompleted) {
      this.scene.start('HomeScene');
      return;
    }
    this.scene.start('GameScene', { mode: 'tutorial' });
  }
}
