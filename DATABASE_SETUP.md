# Connect a free Supabase PostgreSQL database to Home

This guide connects the Home player accounts and cloud saves to a PostgreSQL database. You do **not** need to write SQL or edit the website code.

## What you need

- A Supabase account: https://supabase.com/
- Access to the Render account that hosts the `hockey-multiplayer` service: https://dashboard.render.com/

The Supabase Free plan is $0 and includes a PostgreSQL database with 500 MB per project. Free projects can pause after a week of very low database activity, and automatic backups are not included. This is suitable for starting and testing Home, but it is not a promise of permanent uptime or backup protection.

## Part A — Create the database in Supabase

1. Open **https://supabase.com/** and choose **Start your project**.
2. Sign up, verify your email if asked, and sign in.
3. Create an organization if Supabase asks. A personal organization is fine.
4. Choose **New project**.
5. Enter the project name: `home`. This is the Supabase project display name.
6. Choose the **Free** plan.
7. Choose a region near the Render service. You can see the Render region in the service's **Settings** page. If you cannot find it, choose the closest available region for now.
8. Create a new, strong **Database Password**. This is the database password, not a Home player's password.
9. Save that database password somewhere private and safe. Do not post it in GitHub, a screenshot, or a chat.
10. Select **Create new project** and wait until the project is ready.

## Part B — Copy the database connection string

1. Open the `home` project in Supabase.
2. At the top of the project page, select **Connect**.
3. Choose **Session pooler** as the connection method.
4. Choose the **URI** format.
5. Copy the whole connection string.
6. If it contains `[YOUR-PASSWORD]`, replace just that placeholder with the Database Password you created in Part A. Keep the rest of the string exactly as Supabase gave it to you, including the default `/postgres` database name.
7. Keep this connection string private. Anyone who has it may be able to connect to your database.

Use **Session pooler** for this Render setup because it works through Supabase's shared connection pooler and avoids common direct-connection IPv4 compatibility problems. Supabase's own connection guide explains where the different connection strings are found.

## Part C — Add it to Render

1. Open **https://dashboard.render.com/** and sign in.
2. Open the workspace containing the service named **hockey-multiplayer**.
3. Select the **hockey-multiplayer** web service. Keep this existing Render service name unchanged: the Home website currently connects to its `hockey-multiplayer.onrender.com` address.
4. In its left-hand menu, select **Environment**.
5. Under Environment Variables, choose **Add Environment Variable**.
6. In **Key**, enter exactly: `DATABASE_URL`.
7. In **Value**, paste the complete Supabase connection string from Part B.
8. Save using **Save, rebuild, and deploy** (or the equivalent deploy option shown by Render).
9. Wait until the latest deployment is marked **Live**.

Do not add the connection string to `render.yaml`, `arcade-portal.js`, `index.html`, or any other file in GitHub. It belongs only in Render's private Environment Variables.

## Part D — Check the connection

After Render says the service is Live, open this address in a new browser tab:

**https://hockey-multiplayer.onrender.com/health/storage**

A successful database connection returns:

```json
{"ok":true,"database":"connected"}
```

Other results:
- `database: "not_configured"` means the `DATABASE_URL` variable has not been added to the service, or the service has not restarted since it was added.
- `database: "unavailable"` means the server cannot reach PostgreSQL. Check that the connection string was copied completely and that the password placeholder was replaced correctly.

The ordinary `/health` address only checks whether the web service is responding. Use `/health/storage` to check PostgreSQL specifically.

## Part E — Test a Home account

Once the storage check says `connected`:

1. Open **https://googledrive-home.github.io/doc/**.
2. Open the player profile / account sign-in panel.
3. Create a test account with a username and a new, unique password.
4. Close the site and open it again.
5. Sign in with that same username and password.
6. Check that the profile loads and that its XP and stats are still present.
7. Play a game long enough to complete a session, then check the profile for XP and any newly unlocked trophies.
8. Open a supported saved game, make progress, leave it, and check that its cloud save is available after signing in on another device.

Do not use the same password as your Supabase database password. The two passwords are for different things.

## What the free plan means

- Supabase Free currently includes 500 MB of database space per project and 5 GB of egress.
- Supabase can pause a Free project after about 7 days of too little database activity. Its data remains there and the project can be restored.
- The Free plan does not include automatic database backups. Keep this in mind before inviting other players to rely on their saves.
- Render's free web service can go to sleep after 15 minutes without traffic, so the first page load after a quiet period may be slower.

Official references:
- Supabase pricing: https://supabase.com/pricing
- Supabase PostgreSQL connection guide: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase free-project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Render environment variables: https://render.com/docs/configure-environment-variables
- Render free service limits: https://render.com/docs/free

If a screen looks different from this guide, use the official Supabase or Render instructions linked above. Never send anyone your Database Password or full `DATABASE_URL`.
