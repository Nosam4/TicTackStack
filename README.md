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

## Supabase setup (cloud saves)

### 1. Create project + enable anonymous auth
- Create a Supabase project.
- In Auth settings, enable Anonymous Sign-ins.

### 2. Create database table and policies
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

## Available scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
