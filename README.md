# Tic-Tac-Stack

Stack-based tic-tac-toe built with React + Vite.

Rules summary:
- You can only place new pieces, never move placed pieces.
- You can place on empty squares or on smaller top pieces.
- You cannot place on same-size or larger top pieces.
- Win detection only reads the top visible piece on each square.

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages

This repo deploys with GitHub Actions using:
- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
- `base: '/TicTackStack/'` in [`vite.config.js`](./vite.config.js)

## Supabase setup (multiplayer rooms)

### 1. Create project + enable anonymous auth
- Create a Supabase project.
- In Auth settings, enable Anonymous Sign-ins.

### 2. Create database tables and policies
- Open the Supabase SQL Editor.
- Run [`supabase/schema.sql`](./supabase/schema.sql).

### 3. Configure local environment
- Copy `.env.example` to `.env`.
- Fill in your values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_ANON_KEY
```

### 4. Configure GitHub Actions secrets for Pages deploy
Because Vite injects env vars at build time, set these repo secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Path in GitHub:
- `Settings -> Secrets and variables -> Actions -> New repository secret`

After setting secrets, push a commit or re-run the deploy workflow.

## Multiplayer room flow

1. Open the deployed app on two devices (for example phone + laptop).
2. On device A, click `Create Room (Player X)`.
3. Share the 6-character room code with device B.
4. On device B, enter the code and click `Join Room`.
5. Device A and B will be assigned `X` and `O`; turns are enforced and moves sync in realtime.

Notes:
- `Reset Room Game` is restricted to Player `X`.
- Leaving a room removes your slot; empty rooms are cleaned up.

## Quick multiplayer test

1. Join the same room from both devices.
2. Play one move from device A and confirm device B updates automatically.
3. Try playing out of turn on device B and confirm the move is blocked.
4. Finish a game and confirm both devices show the same winner.
5. Click `Leave Room` on one device and confirm room status changes for the other player.

## Available scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
