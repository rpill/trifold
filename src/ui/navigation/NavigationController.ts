import { ROUTE_SCENES, type UiRoute } from './UiRoute.ts';

export interface SceneNavigator {
  start(sceneKey: string, data?: Readonly<Record<string, unknown>>): unknown;
}

export class NavigationController {
  private readonly scene: SceneNavigator;

  constructor(scene: SceneNavigator) {
    this.scene = scene;
  }

  go(route: UiRoute, payload?: Readonly<Record<string, unknown>>): void {
    this.scene.start(ROUTE_SCENES[route], payload);
  }

  home(): void {
    this.go('home');
  }
}
