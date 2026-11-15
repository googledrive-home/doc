# Home player progression and shop

This document describes the connected-platform features currently implemented on the `platform-shop-economy` development branch.

## Player account and currency

Google Drive Home remains the source of truth for player identity, XP, level and Credits. Currency is stored on the existing account record in the PostgreSQL-backed account store.

The wallet contains:
- `currencyBalance`: spendable Credits.
- `currencyEarnedTotal`: lifetime Credits earned, used for rankings.
- `currencyTransactions`: a bounded transaction history with a reason and resulting balance.

Credits are earned through eligible Home game sessions, newly unlocked achievements, level-ups and completed challenges. Session rewards have a daily cap. XP and Credits are separate: levels are earned from XP and are not purchasable.

## Shop catalogue and tiers

Shop items are configured in `hockey-server/src/index.js`. The initial catalogue is cosmetic-only (avatar frames, badges and profile banners).

| Tier | Minimum level |
| --- | ---: |
| Starter | 1 |
| Bronze | 5 |
| Silver | 10 |
| Gold | 20 |
| Elite | 35 |
| Legendary | 50 |

Purchases are checked and processed on the server. The server validates the item, level requirement, ownership and wallet balance before debiting Credits and granting inventory ownership. Equipped items are saved on the account.

## API

All routes require the existing bearer account session unless otherwise stated.

- `GET /account/shop` — wallet, tier definitions, catalogue, ownership, inventory and equipped cosmetics.
- `POST /account/shop/purchase` — body: `{ "itemId": "frame-classic" }`.
- `POST /account/shop/equip` — body: `{ "itemId": "frame-classic", "equipped": true }`.
- `GET /account/challenges` — current daily and weekly challenges and progress.
- `GET /account/platform-leaderboard?category=xp` — opt-in platform rankings. Supported categories: `xp`, `level`, `achievements`, `games`, `weekly-xp`, `credits-earned`.
- `POST /account/bridge` — creates a random one-time Home-to-F1 hand-off code. The code expires after two minutes and only its hash is stored.
- `POST /account/bridge/exchange` — consumes a hand-off code once and returns a normal Home account session.

## Challenges

Challenge progress is stored on the account and advances when a tracked Home game session completes. Daily periods use UTC calendar days; weekly periods start on Monday UTC. Rewards are automatically credited once per challenge period.

The initial challenge catalogue is defined in `CHALLENGE_DEFINITIONS` in the server.

## Leaderboard privacy

Platform rankings include only accounts with `leaderboardOptIn === true`. The endpoint returns the viewer's position separately and uses `private, no-store` caching because that response can contain viewer-specific information.

The existing per-game high-score endpoint is still separate and remains labelled as unverified client-reported scores.

## Important scope boundary

The existing Home game-session tracker awards activity rewards from server-recorded session duration. This does not independently prove that an F1 race was completed or that client-reported race telemetry is authentic. Verified F1 race-result validation is a separate future task.
