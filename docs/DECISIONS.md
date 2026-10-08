# Decisions & assumptions

- **Docs location.** The prompt names `docs/PROMPT.md` and `docs/mockups/…`; the files on disk are
  `docs/rijschool-planner-claude-code-prompt.md` and `docs/RijSchool-Planner-mockups.pdf`. Left untouched
  (rule: never edit `docs/` contents). The on-disk prompt is an older, shorter version than the one pasted in chat; the pasted one was treated as authoritative.
- **Next.js 16.4** (bundled docs consulted). `middleware` is now `proxy.ts`. `cacheComponents`/`partialPrefetching`
  from the scaffold were turned off: every page is per-user and dynamic.
- **Prisma 7**: `prisma.config.ts` holds the datasource URL, client generated to `src/generated/prisma`
  (git-ignored, generated on `postinstall`), runtime uses the `@prisma/adapter-pg` driver adapter.
- **Locale** is cookie-based (`NEXT_LOCALE`) and mirrored on `User.locale`; URLs are not prefixed with a locale.
  Route paths are Dutch (`/leerlingen`) as in the prompt.
- **Font**: Inter as the prompt says. The mockup PDF looks like Poppins; easy to switch in `layout.tsx` if preferred.
- **Auth**: Auth.js v5 JWT sessions, two Credentials providers (password, single-use magic link). Magic-link and
  invite tokens are stored hashed (SHA-256). Login is rate limited in memory (8 tries / 10 min / e-mail) — replace with
  Redis/Upstash once running on several serverless instances. The DAL re-reads the user from the database on every request,
  so deactivating a user takes effect immediately.
- **Hours ledger semantics.** `minutesRemaining` = PURCHASE + CONSUME + ADJUST + REFUND (hours still owned, incl. reserved);
  `minutesReserved` = hours held by planned lessons (RESERVE − RELEASE). Hours available to book = remaining − reserved.
- **DB guards** (migration 0002): exclusion constraints for overlapping PLANNED/COMPLETED lessons per instructor and per vehicle
  (theory-group lessons excluded from the instructor constraint), `endsAt > startsAt`, and an append-only trigger on
  `HoursLedgerEntry`. The GDPR erasure flow may delete ledger rows by setting `app.allow_ledger_delete = 'on'` in its transaction.
- **Theory groups** also get one `Lesson` row (type THEORY, `theoryGroupId`) so calendars and conflict checks treat them uniformly.
- **Seed** places lessons relative to the current ISO week so screens are populated whenever it is run.
- Node 25 (non-LTS) is installed locally; CI uses Node 24 LTS.
- Docker is not installed on the dev machine; `docker-compose.yml` is provided and any local PostgreSQL works.
