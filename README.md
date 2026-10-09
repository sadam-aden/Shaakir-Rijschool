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
| `npm run test:e2e` | Playwright end-to-end tests: builds the app into `.next-e2e`, serves it on port 3100 against a separate `<database>_test` database that is re-seeded on every run (never touches your dev data). Uses the installed Edge locally; in CI run `npx playwright install chromium` first. The first run takes several minutes (build). |
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

## Try the Phase 1 features

1. `npm run dev`, log in as `shaakir@example.com`.
2. **Agenda** → drag a student from "In te plannen" onto a day (the student's availability lights up); drag a lesson to move it.
3. **Les inplannen** → pick a student, a date and the "Beste keuze" slot, then confirm (e-mails/SMS are printed in the server log).
4. **Lessen** → open a lesson, check it off with skill sliders, mark a no-show or cancel (see how the 24-hour rule decides if hours are charged).
5. **Leerlingen** → filters, availability grid, profile page; **Instructeurs / Lesauto's / Pakketten / Instellingen** under "Beheer".

## Money: invoices, iDEAL, SMS and background jobs

Everything works without accounts (test/mock mode). To go live, set these in `.env` (see `.env.example`):

| What | Variables | Notes |
| --- | --- | --- |
| iDEAL | `MOLLIE_API_KEY`, `APP_URL` | `test_…` = Mollie test mode. `APP_URL` must be the public https address so Mollie can reach `/api/webhooks/mollie`. Without a key the app shows a local mock checkout page. |
| SMS | `SMS_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — or — `SMS_PROVIDER=bird` + `BIRD_API_KEY` | The sender name (max 11 characters, default ShaakirRS) is set in Settings. Without keys SMS texts are printed in the server log. |
| E-mail | `RESEND_API_KEY`, `EMAIL_FROM` | Invoices go out as PDF attachments. |
| Jobs | `CRON_SECRET` (long random value) | Call `GET /api/cron/run` with `Authorization: Bearer <secret>`. `vercel.json` schedules it daily; use Vercel Pro or an external scheduler every 15 minutes for exact 24 h reminders. Settings → "Run now" runs it by hand. |

Try it locally: **Students → a student → Payments → Add package** creates an invoice. **Payments & hours → Send iDEAL link** creates the link; open it from the invoice page and press "Payment succeeds" on the mock checkout.

## AI scheduling

1. Click **Planning genereren** (top right on any page), pick a date (or a range) and press **Genereren**. The planner drafts the day in a few seconds.
2. Open **Agenda**: the draft lessons are dashed and a banner shows what the planner did and who it could not place and why. Drag lessons to adjust, or remove one.
3. Press **Goedkeuren & leerlingen informeren** to make the lessons real (hours reserved, students informed), or **Verwerpen** to throw the draft away.

The rules are shown in the calendar and can be tuned in **Instellingen → AI-planningsregels**. Optional: set `ANTHROPIC_API_KEY` to let Claude write the short summary above the draft (it only ever sees anonymous labels, never names or addresses).
