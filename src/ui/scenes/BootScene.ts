import Phaser from 'phaser';
import { getRuntimeServices } from '../../meta/RuntimeServices.ts';
import { preloadCardFaceAssets } from '../../game/view/CardFaceAssets.ts';
import { preloadUiAssets } from '../assets/UiAssets.ts';
import { getVisualQaLaunch, markVisualQaReady } from '../../dev/visual-qa/VisualQaMode.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    preloadUiAssets(this);
    preloadCardFaceAssets(this);
  }

  create(): void {
    const visualQa = getVisualQaLaunch();
    if (visualQa) {
      const target = this.scene.get(visualQa.scene);
      target.events.once(Phaser.Scenes.Events.CREATE, () => markVisualQaReady('scene-created'));
      this.scene.start(visualQa.scene, visualQa.sceneData);
      return;
    }
    if (getRuntimeServices().preferences.howToPlaySeen) {
      this.scene.start('HomeScene');
      return;
    }
    this.scene.start('GameScene', { mode: 'tutorial' });
  }
}
