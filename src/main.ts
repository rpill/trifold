import Phaser from 'phaser';
import './styles.css';
import { startWhenHostReady } from './bootstrap/GameBootstrap.ts';
import { GameScene } from './game/scenes/GameScene.ts';
import { planHiDpiCanvas } from './render/HiDpiCanvas.ts';

const hostElement = document.querySelector<HTMLElement>('#game');
if (!hostElement) throw new Error('Missing #game host.');
const host: HTMLElement = hostElement;

function readHostSize(): { width: number; height: number } {
  const rect = host.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

void startWhenHostReady(readHostSize, ({ width, height }) => {
  let current = planHiDpiCanvas(width, height, window.devicePixelRatio);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: current.backingWidth,
    height: current.backingHeight,
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: current.cssZoom,
      autoRound: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
    scene: [GameScene],
  });

  const resize = (): void => {
    const size = readHostSize();
    const next = planHiDpiCanvas(size.width, size.height, window.devicePixelRatio);
    const zoomChanged = next.cssZoom !== current.cssZoom;
    const sizeChanged = next.backingWidth !== current.backingWidth
      || next.backingHeight !== current.backingHeight;
    if (zoomChanged) game.scale.setZoom(next.cssZoom);
    if (sizeChanged) game.scale.resize(next.backingWidth, next.backingHeight);
    current = next;
  };

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener('resize', resize);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    window.removeEventListener('resize', resize);
  });

  return game;
});
