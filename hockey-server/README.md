# Hockey Multiplayer Server

Colyseus WebSocket server for the Hockey game. The static game can remain on GitHub Pages; this service hosts live rooms.

## Deploy to Render
1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select this repository. Render reads `render.yaml`.
3. Wait for the service to deploy, then open `https://YOUR-SERVICE.onrender.com/health`. It should return `{"ok":true}`.
4. Configure the Hockey client to connect to `wss://YOUR-SERVICE.onrender.com` using the Colyseus SDK.
5. Test private room codes, public matchmaking, reconnection and matches on two separate devices before announcing it as live.

## Important implementation notes
- Keep the server authoritative for movement, puck interactions, goals, timers and AI. The included room is a starter scaffold, not a finished competitive simulation.
- Never put server secrets in the browser.
- The room service currently exposes a health endpoint and the initial room protocol. The existing Hockey client still needs a multiplayer UI/client adapter before players can join matches.
- Use a paid always-on service for consistent matchmaking; free instances may sleep or have limits.

## Player accounts and lifetime statistics

The game now supports email/password account registration, sign-in, player name and skin profiles, lifetime statistics, online playtime, cumulative match time, and the last 30 completed match reports. Passwords are stored as salted scrypt hashes, while browser sessions use random bearer tokens whose hashes are stored server-side; sessions expire after 30 days.

### Persistent storage

The server uses PostgreSQL whenever `DATABASE_URL` is set. On startup it creates its account-store table and loads profile/stat data from it. For local development only, it falls back to `DATA_DIR/accounts.json` (or `./data/accounts.json` if `DATA_DIR` is not set).

**Important for Render:** this repository currently defines the game service on Render's Free plan. Its local filesystem is ephemeral, so the JSON fallback is not a safe place for real account data across restarts, spin-downs or redeploys. Before players rely on accounts, connect a durable PostgreSQL database and set the game's `DATABASE_URL` environment variable to its connection string in the Render Dashboard. Do not put the database URL in source control. A free Render Postgres database has a 30-day lifetime; use a database arrangement with suitable long-term retention for real player accounts.

The application does not change the service's hosting plan or create a paid database automatically.

