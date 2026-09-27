export interface VisualQaViewportPreset {
  readonly width: number;
  readonly height: number;
  readonly touchPrimary: boolean;
}

export const VISUAL_QA_VIEWPORT_PRESETS: Readonly<Record<string, VisualQaViewportPreset>> = Object.freeze({
  '1920x1080': { width: 1920, height: 1080, touchPrimary: false },
  '1366x768': { width: 1366, height: 768, touchPrimary: false },
  '1280x640': { width: 1280, height: 640, touchPrimary: false },
  '844x390-touch': { width: 844, height: 390, touchPrimary: true },
  '915x412-touch': { width: 915, height: 412, touchPrimary: true },
});
