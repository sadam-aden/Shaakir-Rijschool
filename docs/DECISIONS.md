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
- **Themes**: Light / Dark / System. Colours are CSS variables in `globals.css`; `<html data-theme>` is set server-side from the
  `theme` cookie (no flash). The choice is stored in a cookie only (not on the user record) to avoid a schema change; moving it to `User` is a small follow-up if wanted.

## Phase 1
- **Slot engine is a pure function** (`checkSlot`) fed by a `SlotContext` loaded in one place (`src/lib/dal/slot-context.ts`). Booking, drag & drop, editing and (Phase 3) the generator all use it; DB exclusion constraints stay the last guard.
- **Overridable conflicts**: only "outside student availability", "student unavailable" and "not enough hours" can be overridden, only by admins, only with a written reason (audit log).
- **Travel feasibility** v1: straight-line distance × 1.3 at 40 km/h between consecutive pickups; falls back to the travel buffer (10 min) when coordinates are missing. Student coordinates are seeded from area centres; PDOK geocoding comes later.
- **Chargeable cancellations**: student cancellation inside the window (24 h default) consumes the hours; school cancellations never do; admin can flip it per case. No-shows consume hours by default.
- **Hours reservation**: planned lessons RESERVE, completion RELEASE + CONSUME; DRAFT lessons reserve nothing. Booking locks the student row (`SELECT … FOR UPDATE`) so two bookings cannot spend the same hours.
- **Exam lessons** create a linked `Exam` row and use a package exam credit when available; otherwise they will be invoiced in Phase 2.
- **Theory in the wizard** enrols the student in an existing group (no hours used). Theory groups also exist as `Lesson` rows so calendars/conflicts treat them like other blocks.
- **Notifications**: plain-text templates (NL/EN) built in code, ICS attached to e-mail confirmations; React Email can replace the plain templates when more mail types arrive in Phase 2. Reminders are queued (`Notification.scheduledFor`); the sender job comes in Phase 2.
- **Calendar drag & drop** uses `@dnd-kit/core` with pointer-based drop detection (column rectangles) instead of droppable zones, which keeps 15-minute snapping exact.
- **E2E isolation**: tests run a separate production build (`.next-e2e`, port 3100) on a `<db>_test` database that is re-seeded for each run.
- **React Compiler lint**: no manual `useMemo` where the compiler already memoises; time-dependent values are read once with `useState(() => Date.now())`.
- **Minimum student age 18** (`MIN_STUDENT_AGE` in `src/lib/domain/age.ts`): date of birth is required and must make the student 18 or older on the day of saving (someone turning 18 today is accepted). Enforced by the shared Zod schema (form + server action). Change the constant for another age; use "19" if "older than 18" must be strict.
- **Login rate limit counts failed attempts only** (8 per 10 min per e-mail); a successful login clears the counter.
- **Deleting students**: admin only, permanent (GDPR erasure), needs the full name typed. Refused when the student has invoices (invoices must be kept for the tax authorities) — archive instead (reversible, hides from lists, "Gearchiveerd" filter). The hours ledger trigger allows deletion only inside the erasure transaction. The audit log keeps just the id and counts.
- **Panel state**: the student panel is keyed by student id so client state (edit form, availability grid, gearbox toggle) can never leak from one selected student to another.
