import { BASE_THEME_ID, getTheme } from './ThemeCatalog.ts';
import type { CardBackStyle } from './CardBackStyle.ts';
import type { ThemeDefinition, ThemeId } from './ThemeDefinition.ts';

function color(value: string): number {
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid theme color: ${value}`);
  return parsed;
}

export class ThemeRuntime {
  private themeId: ThemeId;

  constructor(themeId: ThemeId = BASE_THEME_ID) {
    this.themeId = themeId;
  }

  get current(): ThemeDefinition {
    return getTheme(this.themeId);
  }

  get boardSurfaceColor(): number {
    return color(this.current.board.surface);
  }

  get slotPalette(): { readonly recess: number; readonly edge: number; readonly highlight: number } {
    return {
      recess: color(this.current.slots.recess),
      edge: color(this.current.slots.edge),
      highlight: color(this.current.slots.highlight),
    };
  }

  get cardBackStyle(): CardBackStyle {
    const palette = this.slotPalette;
    return {
      paper: 0xe8e2cf,
      edge: palette.edge,
      innerEdge: palette.highlight,
      patternA: palette.recess,
      patternB: 0xeef1ea,
    };
  }

  setTheme(id: ThemeId): void {
    this.themeId = id;
  }
}
