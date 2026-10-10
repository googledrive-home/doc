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
