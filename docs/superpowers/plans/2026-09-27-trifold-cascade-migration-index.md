# Trifold Cascade Product-Shell Migration — Plan Index

**Spec:** `docs/superpowers/specs/2026-09-27-trifold-cascade-product-shell-design.md`

This migration is deliberately split into six sequential implementation plans. Each plan must finish green before the next starts. Do not combine a Phaser 4 migration or the future Trifold visual redesign with these plans.

1. `2026-09-27-trifold-product-reset.md` — remove Themes/economy and introduce fixed appearance.
2. `2026-09-27-trifold-meta-persistence.md` — Cascade-derived meta state, legacy migration, active-game persistence.
3. `2026-09-27-trifold-platform-leaderboards.md` — Cascade-derived Yandex services, preferences, leaderboards, interstitial policy.
4. `2026-09-27-trifold-product-behavior.md` — Standard, Daily, Mastery, first-result policy, free Hint, product bridge.
5. `2026-09-27-trifold-product-ui-responsive.md` — Home/Leaders/Settings/completion shell and responsive gameplay integration while staying on Phaser 3.
6. `2026-09-27-trifold-visual-qa-cleanup.md` — reusable Visual QA harness, baseline matrix, final dead-code/assets cleanup.

## Cross-plan invariants

- Trifold rules/model/solver/deal catalog remain authoritative and unchanged unless a test proves an integration defect.
- `NumericSuit = 'coins' | 'bamboo' | 'characters'` is gameplay terminology and must survive every cleanup/search.
- Trifold remains on Phaser `3.90.0` for the whole migration.
- Hint is free; there is no rewarded-hint gate.
- Themes, currency coins, shop, payments, coin packs and double-reward do not survive plan 1.
- Product/meta persistence and active-game persistence are separate after plan 2.
- Leaderboard technical names remain Trifold-specific.
- Every plan ends with `pnpm build` plus the targeted tests named in that plan; no known failing tests are carried forward intentionally.
- If the execution environment has no `.git` directory, do not initialize a repository just to satisfy plan commit steps; treat each commit step as a review checkpoint and return the changed archive instead.
