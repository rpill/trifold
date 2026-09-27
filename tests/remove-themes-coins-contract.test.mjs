import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(ROOT, 'src');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(?:ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

test('shipping source contains no theme, shop, currency or purchase product concepts', () => {
  const forbidden = [
    'ThemesScene',
    'ThemeRuntime',
    'ShopService',
    'CoinPill',
    'CoinPack',
    'RewardDouble',
    'PurchaseReconciliation',
    'ownedThemeIds',
    'activeThemeId',
    'claimedRewardKeys',
    'ThemeCatalog',
    'ThemeDefinition',
    'baseCoinsGranted',
    'coinsGranted',
    'rewardCoins',
    'firstCompletionRewardClaimed',
    'doubleCoins',
    'coinIcon',
  ];

  const hits = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const token of forbidden) {
      if (text.includes(token)) hits.push(`${relative(ROOT, file)}: ${token}`);
    }
  }

  assert.deepEqual(hits, []);
  assert.equal(existsSync(join(SRC, 'theme')), false, 'legacy src/theme directory must be removed');
});


test('authored UI sources no longer generate or document the removed Themes product surface', () => {
  const files = [
    join(ROOT, 'tools/ui/build-ui-motifs.mjs'),
    join(ROOT, 'assets-src/ui/README.md'),
  ];
  const forbidden = ['theme-fan', 'Themes navigation', 'wide Themes row', 'selected theme'];
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const token of forbidden) {
      if (text.includes(token)) hits.push(`${relative(ROOT, file)}: ${token}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('superseded economy/theme product documents are removed', () => {
  for (const path of [
    'docs/superpowers/plans/2026-09-14-trifold-daily-retention.md',
    'docs/superpowers/plans/2026-09-14-trifold-economy-themes-monetization.md',
    'docs/superpowers/plans/2026-09-14-trifold-hints-tutorial-release.md',
    'docs/superpowers/plans/2026-09-14-trifold-meta-core-standard-mastery.md',
    'docs/superpowers/plans/2026-09-14-trifold-ui-ux-navigation.md',
    'docs/superpowers/plans/2026-09-14-trifold-yandex-platform-cloud-leaderboards-analytics.md',
    'docs/superpowers/plans/2026-09-15-jade-interface.md',
    'docs/superpowers/specs/2026-09-14-trifold-meta-progression-design.md',
    'docs/superpowers/specs/2026-09-14-trifold-ui-ux-design.md',
  ]) {
    assert.equal(existsSync(join(ROOT, path)), false, `${path} is superseded by the Cascade product-shell migration`);
  }
});

test('gameplay coins suit and coins foundation survive the product reset', () => {
  const types = readFileSync(join(SRC, 'game/model/types.ts'), 'utf8');
  const game = readFileSync(join(SRC, 'game/model/TrifoldGame.ts'), 'utf8');
  const rulesTest = readFileSync(join(ROOT, 'tests/trifold-rules.test.ts'), 'utf8');
  const gameTest = readFileSync(join(ROOT, 'tests/trifold-game.test.ts'), 'utf8');

  assert.match(types, /NumericSuit\s*=\s*'coins'\s*\|\s*'bamboo'\s*\|\s*'characters'/);
  assert.match(game, /foundations\.coins/);
  assert.match(rulesTest, /foundations:\s*\{\s*coins:/);
  assert.match(gameTest, /foundations\.coins/);
});

test('transitional legacy profile runtime classes are removed after product-shell cutover', () => {
  for (const path of [
    'src/meta/profile/ProfileRepository.ts',
    'src/meta/profile/LocalProfileStore.ts',
    'src/meta/profile/CloudProfileStore.ts',
  ]) {
    assert.equal(existsSync(join(ROOT, path)), false, `${path} must be deleted after MetaSession cutover`);
  }
});
