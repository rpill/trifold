# Trifold Meta, Progression, Daily, Economy & Retention Design

**Date:** 2026-09-14

## Goal

Turn Trifold from a strong standalone Shenzhen-solitaire core into a complete Yandex Games product with long-term retention, cosmetic progression, fair competition, and voluntary monetization without compromising the puzzle itself.

The product must remain immediately playable for a guest, keep Standard play frictionless, make Daily the main competitive mode, and use Mastery to represent demonstrated skill rather than meaningless XP accumulation.

---

## 1. Product Pillars

1. **Standard is the main evergreen mode.**
   - 40,000 solver-verified deals.
   - Player chooses Easy / Medium / Hard freely at any time.
   - The game prefers unseen deals before repeats.
   - The player is never locked out of easier content because of rank.

2. **Daily is the main competitive/retention mode.**
   - One verified deal per calendar date.
   - 7,305 daily deals from 2026-01-01.
   - Daily streak, archive, calendar, official result, and leaderboard.

3. **Mastery represents proven skill.**
   - No generic XP level.
   - Rank promotions require wins on specific difficulties.
   - Easy remains valid casual play even when it no longer advances Mastery.

4. **Economy is cosmetic-only.**
   - One soft currency: coins.
   - Themes are the primary sink.
   - No gameplay power, energy, lives, pay-to-win, or consumable undo.

5. **Monetization is voluntary.**
   - Rewarded ad for a Standard hint.
   - Rewarded ad to double eligible post-win coins.
   - One Yandex Payments coin pack.
   - No forced interstitials.
   - No gameplay banner on release.

---

## 2. Standard Mode

### 2.1 Difficulty selection

Standard exposes three difficulties:

- Easy
- Medium
- Hard

The player can always select any of them regardless of Mastery rank.

The main Play action starts Standard using the player's last selected difficulty. The UI may show a recommended difficulty based on current Mastery progress, but recommendation never overrides the player's choice.

### 2.2 New-deal selection

Each difficulty tracks its own seen/completed seed history.

When the player requests a new deal:

1. Prefer a seed in the selected difficulty that the player has never completed.
2. Do not repeat completed seeds while unused verified seeds remain in that pool.
3. Replays are allowed through replay/history flows, but do not count as a fresh rewardable completion.

### 2.3 Onboarding pool

The 500 onboarding deals are used only for the player's earliest Standard experience.

- The first 5 Standard wins use unseen onboarding-pool deals by default when the player follows the normal Play flow.
- They are not presented as a separate "training campaign".
- A player may manually choose Medium or Hard immediately; an explicit difficulty choice bypasses the automatic onboarding selection for that deal. Onboarding must never be a progression gate.

### 2.4 Persistence

An unfinished Standard game is persisted locally and, when signed in, in cloud profile data.

On return:

- Continue restores the existing deal and state.
- Starting a new deal is always an explicit action.

---

## 3. Mastery

### 3.1 Principle

Difficulty is a mood choice; Mastery is proof of maximum demonstrated skill.

Mastery does not restrict which difficulty can be played and never decreases.

### 3.2 Ranks

The release version has six ranks:

1. Novice
2. Player
3. Tactician
4. Expert
5. Master
6. Grandmaster

### 3.3 Promotion requirements

Requirements are stage-local: progress used to earn one promotion does not automatically carry into the next stage.

| Promotion | Requirement during this stage | Coin reward |
| --- | --- | ---: |
| Novice → Player | 10 unassisted wins of any difficulty | 100 |
| Player → Tactician | 15 Medium + 3 Hard unassisted wins | 150 |
| Tactician → Expert | 25 Medium + 10 Hard unassisted wins | 200 |
| Expert → Master | 25 Hard + 5 on-time Daily wins | 300 |
| Master → Grandmaster | 60 Hard + 15 on-time Daily wins | 500 |

Only the first unassisted completion of a Standard seed can advance Mastery. A replay of the same seed never advances Mastery again.

A Daily date can advance Mastery at most once.

### 3.4 Mastery UI

Do not show only an abstract percentage.

Example:

> To Master  
> Hard: 18 / 25  
> Daily: 3 / 5

The player should always understand exactly what is required next.

### 3.5 Prestige

Prestige is **post-launch**, not required for release.

However, release persistence must already retain all information needed to add it later without losing history:

- unique Medium completions;
- unique Hard completions;
- Daily completion history;
- Mastery rank and stage progress;
- completed Standard seed ids.

The planned future scoring model is:

- Easy = 0 Prestige points
- Medium = 1
- Hard = 3
- Daily = 5
- 30 Prestige points = Prestige +1
- future reward target: 50 coins per Prestige level

This formula is informative for data compatibility, but no Prestige UI or reward flow ships in v1.

---

## 4. Coins and Economy

### 4.1 Currency

There is exactly one soft currency: coins.

### 4.2 Standard rewards

For the first completion of a previously uncompleted seed:

- Easy: 5 coins
- Medium: 7 coins
- Hard: 10 coins

Repeating a completed seed gives no base coin reward.

Assisted Standard wins still receive their normal base coin reward, but do not advance Mastery or official personal records.

### 4.3 Daily rewards

- Today's Daily, first completion: 15 coins
- Archived Daily, first completion: 5 coins
- Replays: 0 base coins

### 4.4 Mastery rewards

Rank-up rewards are defined in the Mastery table and are granted once per promotion.

### 4.5 Theme pricing

Release target:

- 1 free base theme
- 6 purchasable themes
- each purchasable theme costs 300 coins

All purchasable themes use the same price at launch. Do not add rarity tiers in v1.

### 4.6 Coin pack

One Yandex Payments coin pack is offered.

Pack amount is defined as:

`paidThemeCount × 300`

With six paid launch themes:

`6 × 300 = 1800 coins`

The pack is an optional cosmetic acceleration purchase. Every theme must remain earnable through normal play.

---

## 5. Theme Contract

Themes may change only:

- gameplay table/background surface;
- card backs;
- empty slots/placeholders;
- lightweight decorative elements around the gameplay area.

Themes must not change:

- card faces;
- ranks;
- numeric suit readability;
- dragons;
- HUD structure;
- buttons;
- navigation;
- gameplay geometry.

Themes are cosmetic and must never affect readability or gameplay advantage.

---

## 6. Daily Mode

### 6.1 Daily identity

Daily is the primary competitive mode.

Each date maps to one solver-verified seed. All players receive the same deal for that date.

The production schedule starts at 2026-01-01 and contains 7,305 dates.

### 6.2 Official result

The player's **first successful completion of today's Daily** becomes that date's official competitive result.

The player may replay the Daily afterward, but later results:

- may improve local personal best;
- do not replace the official leaderboard result;
- do not alter the recorded first-win result.

Abandoning or losing an attempt does not consume the Daily. The official result is created only on the first win.

### 6.3 Ranking order

Daily ranking priority is:

1. fewer player decision moves;
2. lower active play time as tie-breaker.

The leaderboard transport may encode these values into one numeric score, but UI must display the human-readable pair, e.g.:

`42 moves · 06:18.4`

The exact encoding constant must respect Yandex leaderboard numeric limits and will be finalized during SDK integration.

### 6.4 Undo in Daily

Undo is allowed.

Move count is monotonic:

- the original player action remains counted after Undo;
- pressing Undo itself adds 0 moves;
- Undo never subtracts moves already committed to the attempt.

### 6.5 Hints in Daily

Hints are disabled completely in Daily.

### 6.6 Daily persistence

Today's unfinished Daily state is persisted and restored while that date remains current.

If the calendar date changes before completion:

- the unfinished old Daily is no longer treated as today's active Daily;
- the new date receives its own Daily;
- the old date remains accessible only through archive rules if still within retention window.

---

## 7. Daily Archive and Streak

### 7.1 Archive window

The Daily archive exposes a rolling 90-date window: today plus the previous 89 calendar dates.

An archived Daily can be completed later, but:

- cannot restore or extend the historical streak retroactively;
- cannot submit a new official leaderboard result for that old day;
- receives only the archived Daily reward (5 coins);
- may store a personal result.

### 7.2 completedOnTime

Each Daily date stores a `completedOnTime` flag.

- `true`: completed during its own calendar date.
- `false`: completed later from the archive.

This distinction drives streak logic and calendar presentation.

### 7.3 Streak behavior

The current streak must not break merely because today's Daily has not yet been played.

Example:

- Yesterday was completed on time.
- Today begins.
- The player still sees the active streak value throughout today.
- Completing today's Daily increases the streak.
- Failing to complete it before the date rolls over breaks the streak on the next day.

Archive completion never repairs a broken streak retroactively.

---

## 8. Leaderboards

Release leaderboards are intentionally limited to meaningful comparisons:

1. Today's Daily leaderboard
   - primary: moves
   - tie-breaker: active time

2. Daily Streak leaderboard
   - best streak

3. Mastery leaderboard
   - long-term rank/progress representation
   - may later extend naturally to Prestige after Prestige launches

Do not create Standard Easy/Medium/Hard time leaderboards because different seeds make direct comparison meaningless.

---

## 9. Hints and Assisted Attempts

### 9.1 Availability

Hints exist only in Standard.

### 9.2 Rewarded flow

One rewarded ad grants one hint.

The hint:

- examines the current state;
- finds one valid next decision using solver logic;
- visually indicates what card/sequence to move and where, or which dragon family to collect;
- never executes the move automatically.

Additional hints require additional rewarded ads.

### 9.3 Assisted state

Using the first hint marks the current attempt as `assisted`.

An assisted win:

- still counts as a normal completed seed for casual progression/history;
- still grants the normal first-completion base coin reward if eligible;
- does not advance Mastery;
- does not set an official Standard personal record;
- never affects competitive metrics.

To obtain an unassisted result for that seed, the player must restart and complete it without hints.

---

## 10. Move Count Contract

A move represents one deliberate player decision.

Count `+1` for:

- moving one card manually;
- moving a valid multi-card sequence manually;
- moving a card into or out of a free cell;
- manually collecting one complete dragon family.

Count `+0` for:

- automatic flower movement;
- automatic numeric foundation movement;
- automatic endgame cleanup;
- Undo itself;
- Reset/New Deal actions.

Undo does not subtract the move that it reverses.

A multi-card sequence is one move regardless of sequence length.

---

## 11. Active-Time Timer Contract

The timer measures active play time, not wall-clock time.

Timer runs while the player is actively in the game table.

Timer pauses while:

- browser/app is backgrounded or hidden;
- a rewarded ad is active;
- Settings, Rules, Shop, or another blocking overlay is open above the game.

Timer continues during automatic foundation movement and endgame cleanup until the actual win state is reached.

Undo never rewinds time.

On win, the timer stops permanently for that attempt.

---

## 12. Win Flow

### 12.1 Standard win screen

Show:

- difficulty;
- moves;
- active time;
- base coin reward;
- Mastery progress when relevant;
- rank-up celebration when relevant;
- assisted warning when applicable;
- optional rewarded `×2 coins` action;
- primary `New Deal` action;
- `Home` action.

`New Deal` immediately starts a new deal of the same selected difficulty without returning to Home.

Win presentation must be short. Do not block the player behind long mandatory celebration animations.

### 12.2 Daily win screen

Show:

- official first-win moves/time;
- current leaderboard placement if available;
- streak;
- Daily coin reward;
- Replay action;
- clear note after first win that replay results do not replace the official Daily result.

---

## 13. Home and Navigation

Home should remain compact.

Primary elements:

- Play — large primary Standard action;
- Daily — prominent secondary action with current streak/status;
- compact Mastery progress block;
- Shop with visible coin balance;
- Leaderboards;
- small service controls for Settings and How to Play.

Do not create a 40,000-item Levels screen. Standard is a continuous verified-deal flow, not a campaign grid.

Difficulty selection should be available near the Play flow without turning Home into three equally dominant Play buttons.

The game remembers the player's most recent Standard difficulty selection.

---

## 14. Tutorial

There is no separate tutorial campaign.

On first launch, the player is dealt a simple onboarding game immediately and receives an interactive tutorial over the live table.

Tutorial covers, in order:

1. building descending alternating-suit numeric sequences;
2. using the three free cells;
3. automatic flower movement;
4. numeric foundations and automatic safe moves;
5. collecting four matching dragons and permanently consuming one free cell;
6. Undo;
7. transition to independently finishing the onboarding deal.

Tutorial is not shown again automatically after completion, but can be replayed from How to Play.

---

## 15. Guest-First Auth and Cloud Save

### 15.1 Guest-first entry

The player can launch and play immediately without authorization.

Local profile persistence supports the full offline/non-authenticated experience.

Yandex authorization is requested contextually when the player wants features that benefit from identity, such as:

- cloud save;
- leaderboards;
- cross-device continuity;
- payments where required.

Do not block first launch behind login.

### 15.2 First cloud merge

When a local profile and cloud profile both exist, merge automatically without forcing a local-vs-cloud choice screen.

Merge rules:

- completed Standard seed ids: union;
- Daily history: merge by date;
- owned themes: union;
- Mastery: keep the more advanced consistent state;
- personal records: keep the better result for each seed/date;
- coin balance: keep the larger balance, do not sum balances;
- current unfinished game: keep the newer valid state.

After merge, persist the unified profile both locally and in cloud.

---

## 16. Monetization

Release monetization is fully voluntary.

### 16.1 Rewarded ads

Rewarded ads are used for:

- one Standard hint;
- doubling an eligible **Standard** first-completion base coin reward.

Daily contains no rewarded-ad actions at all. Rank-up rewards, Daily rewards, archive rewards, purchases, and other grants are never doubled.

### 16.2 No forced ads

Release must not use:

- interstitial ads after wins;
- forced ads between deals;
- gameplay banners;
- energy/lives;
- paid Undo;
- paid easy deals;
- paid Daily retries.

A Home/Shop banner may be evaluated post-launch only if monetization data justifies it.

### 16.3 Payments

One coin pack is offered via Yandex Payments, sized to the total cost of all launch paid themes.

---

## 17. Analytics

Integrate Yandex Metrica for release.

Minimum event set:

- first_run;
- standard_start;
- standard_win;
- standard_reset;
- standard_difficulty_selected;
- daily_open;
- daily_start;
- daily_win;
- daily_archive_open;
- daily_archive_win;
- streak_changed;
- mastery_rank_up;
- hint_attempt;
- hint_success;
- reward_double_attempt;
- reward_double_success;
- shop_open;
- theme_purchase;
- theme_apply;
- coin_pack_purchase;
- leaderboard_open;
- auth_success.

Standard/Daily completion analytics should include relevant non-sensitive gameplay dimensions such as:

- difficulty;
- moves;
- active duration;
- assisted/unassisted;
- seed category where appropriate.

Analytics must not be required for gameplay to function.

---

## 18. Release Scope

### Required for v1

- Standard Easy / Medium / Hard
- onboarding flow
- persistence / Continue
- Mastery ranks and rewards
- coins
- 1 free + 6 paid themes
- Shop
- Daily
- 90-day Daily archive
- streak
- Daily leaderboard
- Streak leaderboard
- Mastery leaderboard
- Standard hints via rewarded ads
- Standard post-win ×2 base coins via rewarded ads
- Yandex Payments coin pack
- guest-first auth and cloud merge
- tutorial
- Yandex Metrica

### Explicitly post-launch

- Prestige UI and rewards
- achievements
- seasonal events
- additional Daily challenge systems
- additional theme drops beyond launch set
- optional Home/Shop banner experiments

### Explicitly out of scope

- large Statistics screen
- XP-based account level
- multiple currencies
- battle pass
- loot boxes/chests
- energy/lives
- forced interstitials
- gameplay banner at launch
- Standard cross-seed speed leaderboards

---

## 19. Data Requirements for Release Persistence

The profile schema must preserve enough information for all approved v1 behavior and future Prestige compatibility.

At minimum retain:

- selected Standard difficulty;
- completed Standard seed ids, partition-aware;
- Standard first-completion/reward state;
- Standard seeds already credited as unassisted Mastery/Prestige-eligible completions;
- Standard personal bests where stored;
- active Standard saved game;
- Daily history for at least the archive window and streak derivation;
- `completedOnTime` per Daily date;
- official Daily result per date;
- Daily personal best per date;
- active Daily saved game/date;
- current streak and best streak (or enough history to derive safely);
- Mastery rank;
- Mastery stage counters;
- coin balance;
- owned themes;
- active theme;
- tutorial completion state;
- assisted flag in active attempt;
- first-win reward eligibility state;
- data required for future Prestige reconstruction.

Profile mutations that affect coins, purchases, rank-up rewards, or first-completion rewards must be idempotent so reload/retry cannot duplicate rewards.

---

## 20. Product Success Criteria

The design is successful if:

1. A new guest can launch and start playing without login friction.
2. The first game teaches Shenzhen-specific rules interactively.
3. Standard always gives the player control over desired difficulty.
4. Mastery rewards skill without punishing casual Easy play.
5. Daily creates a fair, comparable competitive result.
6. Undo remains useful without allowing Daily score laundering.
7. Archive prevents missed content from disappearing while preserving streak meaning.
8. Cosmetics provide the full soft-currency sink without affecting gameplay readability.
9. All monetization is voluntary at launch.
10. Persistence/cloud merge does not casually destroy progress or duplicate currency.
11. v1 stores enough history to add Prestige later without resetting players.
