# RijSchool Planner

Management system for **Shaakir Rijschool** (Rotterdam): students, instructors, lessons, hours ledger,
invoices and AI-assisted scheduling. Dutch (default) and English.

Stack: Next.js (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma 7 · Auth.js v5 · next-intl · Vitest · Playwright.

## Setup

1. Install Node.js (LTS) and either Docker **or** PostgreSQL 16+.
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in (at minimum `DATABASE_URL` and `AUTH_SECRET`).
4. Start a database: `docker compose up -d` (matches the default `DATABASE_URL`), or point `DATABASE_URL` at your own Postgres.
5. `npm run db:migrate` — applies the migrations (including the raw-SQL exclusion constraints).
6. `npm run db:seed` — loads demo data (**wipes the database**; refuses to run in production).
7. `npm run dev` → http://localhost:3000

Seeded logins (password `RijSchool2026!`, override with `SEED_PASSWORD`):

| Role | E-mail |
| --- | --- |
| Admin + instructor | shaakir@example.com |
| Instructor | anouk@example.com |

Without API keys the app uses console/mock providers: e-mails and magic links are printed in the server log.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | Quality checks (run by CI) |
| `npm run test:e2e` | Playwright (from Phase 1) |
| `npm run db:migrate` / `db:seed` / `db:reset` | Database |

## Project layout

```
src/app            routes (Dutch paths: /leerlingen, /agenda, …)
src/components     UI + app shell
src/lib/dal        role-scoped data access — the only place that queries on behalf of a user
src/lib/domain     pure business logic with unit tests
src/lib/providers  e-mail / SMS / payments behind interfaces (mock when keys are missing)
prisma             schema, migrations, seed
messages           nl.json / en.json (key parity enforced by tests)
docs               prompt, mockups, PROGRESS.md, DECISIONS.md
```

## Deploying (Vercel EU + Neon/Supabase EU)

1. Create a Postgres database in an EU region; set `DATABASE_URL`.
2. Create a Vercel project (region `fra1`/`ams1`), add all variables from `.env.example`.
3. Run `npx prisma migrate deploy` against the production database (do **not** run the seed).
