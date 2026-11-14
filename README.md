# Home

Home is a browser-based game library with player profiles, XP, achievements, friends, career progress and cloud saves.

## Getting started

- Open the live site: https://googledrive-home.github.io/doc/
- Follow the beginner database setup guide: [DATABASE_SETUP.md](DATABASE_SETUP.md)
- The backend lives in [hockey-server](hockey-server/README.md).

## Important

Player accounts and cloud saves need a PostgreSQL database connected to the Render `hockey-multiplayer` service using its private `DATABASE_URL` environment variable. Never commit database passwords or connection strings to this repository.
