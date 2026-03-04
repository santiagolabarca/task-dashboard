# Task Dashboard (Next.js + Local SQLite)

Mobile-responsive, local-first task dashboard backed by a real local database.

## Stack

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- SQLite via Node built-in `node:sqlite`

## Quick Start

```bash
cd /Users/santiagolabarca/demo/task-dashboard
npm install
cp .env.example .env.local
npm run db:init
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env.local`:

```env
TASK_DB_PATH=./data/tasks.db
DEFAULT_OWNER_EMAIL=Santiago.labarca@berkeley.edu
DEFAULT_OWNER_NAME=Santiago Labarca
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Optional, only for one-time data import from Apps Script:
NEXT_PUBLIC_APPS_SCRIPT_URL=
```

## Database Commands

Initialize local DB/table:

```bash
npm run db:init
```

One-time import from existing Apps Script source:

```bash
npm run db:migrate:from-sheet
```

## Local API (used by frontend)

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `GET /api/auth/me`
- `POST /api/auth/google`
- `POST /api/auth/logout`

`statusNextStep` is computed server-side from due date + final status.

## Notes

- Main app runtime uses local SQLite with per-user task isolation.
- Sign-in uses Google Identity (ID token) and keeps a server session cookie for 15 days.
- Existing imported tasks are attached to `DEFAULT_OWNER_EMAIL` so your account starts with your data.
- `apps-script.gs` is only needed as optional source for one-time migration.
