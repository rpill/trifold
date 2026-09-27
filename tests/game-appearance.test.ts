import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const appearanceUrl = new URL('../src/game/appearance/GameAppearance.ts', import.meta.url);

test('fixed Trifold appearance preserves the old base-theme colors without profile input', async () => {
  assert.equal(existsSync(appearanceUrl), true, 'GameAppearance.ts must define the fixed shipping appearance');
  const { TRIFOLD_APPEARANCE } = await import('../src/game/appearance/GameAppearance.ts');
  assert.equal(TRIFOLD_APPEARANCE.boardSurfaceColor, 0x183f2f);
  assert.deepEqual(TRIFOLD_APPEARANCE.slotPalette, {
    recess: 0x173a2d,
    edge: 0x8aa095,
    highlight: 0xd7b84d,
  });
  assert.deepEqual(TRIFOLD_APPEARANCE.cardBackStyle, {
    paper: 0xe8e2cf,
    edge: 0x8aa095,
    innerEdge: 0xd7b84d,
    patternA: 0x173a2d,
    patternB: 0xeef1ea,
  });
  assert.equal('setTheme' in TRIFOLD_APPEARANCE, false);
  assert.equal('themeId' in TRIFOLD_APPEARANCE, false);
});
