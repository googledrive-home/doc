# PlaySpace account and game server

This Node.js service hosts the Colyseus game server and the PlaySpace account API. The static game portal remains on GitHub Pages.

## Deploy to Render

The repository includes a `render.yaml` Blueprint for the `hockey-multiplayer` web service.

1. Connect the GitHub repository to Render.
2. Deploy the `hockey-multiplayer` service from the repository's `main` branch.
3. Keep the service's health-check path set to `/health`.
4. The Render service URL used by the portal is `https://hockey-multiplayer.onrender.com`.

Render automatically deploys new commits when the service's auto-deploy setting is enabled.

## Player accounts and statistics

Players sign up with a **username and password**. Passwords are stored as salted scrypt hashes. Browser sessions use random bearer tokens; only token hashes are stored by the server.

The account API stores profiles, XP, game statistics, achievements, friends, career progress, likes and cloud saves. Completed game sessions update a player's best score; when a new positive personal best is saved, the server awards the Personal Best trophy.

## PostgreSQL storage

The server uses PostgreSQL whenever `DATABASE_URL` is configured. On startup it creates the `hockey_account_store` table automatically and loads the account store from it. The `pg` package is already included in `package.json`.

For local development only, the server falls back to `DATA_DIR/accounts.json` (or `./data/accounts.json`). Do not rely on that JSON fallback for production accounts on Render because the free web service's filesystem is ephemeral.

### Free database setup

For a no-cost starter setup, the project includes a step-by-step [Supabase PostgreSQL setup guide](../DATABASE_SETUP.md).

In brief:

1. Create a Supabase Free project.
2. In Supabase choose **Connect → Session pooler → URI** and copy its connection string.
3. In Render open the `hockey-multiplayer` service, select **Environment**, and add `DATABASE_URL` with that full connection string as the value.
4. Save, rebuild and deploy the Render service.
5. Visit `https://hockey-multiplayer.onrender.com/health/storage`. A working database returns `{"ok":true,"database":"connected"}`.

Do not put `DATABASE_URL`, its password, or any other secret in GitHub, the browser code, screenshots, or chat messages.

Supabase Free currently includes 500 MB of PostgreSQL storage per project. Free projects may pause after a week of very low activity and automatic backups are not included. It is useful for starting and testing, but keep independent backups before relying on the data.

## Health checks

- `/health` checks that the web service is responding. Render uses this endpoint.
- `/health/storage` performs a database connectivity check and returns only whether PostgreSQL is connected, not credentials or other secret information.

## Cloud saves

The authenticated save API stores a JSON save object per supported game. The browser bridge only syncs explicitly allow-listed game-save keys and excludes passwords, tokens, account data and settings. Cloud saves are limited to 48 KB per game.

## Notes

- The free Render web service can sleep after inactivity, so the first request after a quiet period may take longer.
- The current score submission is sent by the game client and is useful for personal profile progress, but it is not cheat-proof server-side competition scoring.
- Test new account creation, sign-in, profile persistence, trophy unlocks and cross-device saves after adding the database connection.
