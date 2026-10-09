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
- **Dutch places list**: province → city/village → neighbourhood (wijk) come from the public PDOK data, generated once by `scripts/build-places.mjs` into `src/data/places/*.json` (2,503 places, 3,423 wijken, committed; no runtime call). The student form stores `province`, `city` and `area` (wijk; migration 0003). A city must come from the chosen province's list; the wijk is free text with suggestions.
- **Address suggestions** call the free PDOK Locatieserver at runtime through `/api/address` (login required, rate limited, 4 s timeout, silent fallback to typing by hand). Picking a suggestion fills street + number, postcode, city, wijk and exact coordinates; otherwise coordinates are the centre of the chosen wijk/city. Apartment variants (12A-01, 12A-02) are collapsed to one suggestion.
- **Students live in the Netherlands**: province and city (from the Dutch lists), a Dutch phone number and an e-mail address are required. Phone numbers are accepted in any common Dutch spelling (06 12345678, +31 6 …, 0031 …, landlines) and stored as E.164 `+31…` (`src/lib/domain/phone.ts`); other country codes are refused. E-mail may be any provider (the placeholder suggests Gmail); say so if only Gmail should be allowed. Search by phone works with both 06… and +31… spellings.
- **Default primary instructor**: new students get the creating admin's own instructor record (Shaakir) pre-selected, and the server falls back to it when none is chosen.
- **Dev DB client refresh**: `src/lib/db.ts` fingerprints the generated Prisma client and replaces the cached dev client when the schema changed, so a new column no longer needs a dev-server restart ("Unknown argument …" after `prisma generate`).
- **Default place**: new students start with province Zuid-Holland and city Rotterdam (`src/lib/defaults.ts`); the field is called just "City" / "Stad".

## Phase 2
- **Invoice amounts**: lines store the GROSS price; net and VAT are derived per rate (VAT = gross − net), so an invoice always equals the package price to the cent. Overdue wins over "partially paid" when the due date has passed (as in the mockup).
- **Hours exist from the moment of sale** (PURCHASE entry at purchase, like the mockup's unpaid students with hours). The setting `allowBookingOnUnpaid` (default off) instead blocks *new* bookings while the student has an overdue unpaid invoice; admins can override with a reason (audited). Moving an already booked lesson is never blocked.
- **Mollie**: plain REST calls (no SDK). The webhook never trusts the request body: it re-fetches the payment. Mollie only calls public URLs, so on localhost the webhook URL is omitted and the status is synced when the student returns to `/pay/return`. A `test_` key = Mollie test mode.
- **Mock mode** (no keys): iDEAL → local mock checkout page (disabled as soon as a Mollie key exists); SMS and e-mail → server log. Every flow can be tested locally without accounts.
- **SMS**: Twilio (Basic auth, alphanumeric sender) and Bird/MessageBird REST. Sender names are cleaned to 11 characters.
- **Jobs**: no job queue service; idempotent jobs behind one secret-protected route (Vercel Cron header supported). Queued lesson reminders are claimed atomically before sending so two runs never send twice.
- **Reminder rules**: level 1 after 3 days overdue, level 2 after 10 (setting `reminderDaysOverdue`); never the same level twice; manual "send all" skips invoices reminded in the last 24 h and always shows the list first.
- **Ledger drift**: the nightly check recomputes balances from the append-only ledger, repairs the cache, writes an audit entry and notifies the admins.
- **Server action safety**: exported functions of `"use server"` files are callable from the browser, so helpers that take a school id live in normal modules (`src/lib/jobs`, `src/lib/dal`), never in action files.
- **PDF storage**: `storage/` locally; on read-only hosts (Vercel) the PDF is simply rendered on demand. Plug object storage in behind `FileStorage` for permanent copies.
- **Accountant export**: CSV (semicolon, BOM, decimal comma, formulas neutralised) in Phase 2; the accountant PDF with VAT summary and prepaid-hours liability comes in Phase 4.
