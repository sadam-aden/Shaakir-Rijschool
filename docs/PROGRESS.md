# Progress

## Phase 0 – Foundation  (tag `phase-0`) ✅
- [x] Git repo, `.gitignore`, `.env.example`, `docker-compose.yml`, GitHub Actions CI
- [x] Next.js 16 + TypeScript strict + Tailwind 4, design tokens from the mockups, light/dark/system themes
- [x] App shell: role-based sidebar, top bar (date/week, search, bell, generate button), user menu
- [x] i18n NL/EN (`next-intl`), language switcher (cookie + user), key-parity test
- [x] Intl formatting, ISO weeks, Europe/Amsterdam DST handling + tests
- [x] Prisma schema (all entities), migrations incl. exclusion constraints + append-only ledger trigger
- [x] Seed with mockup data
- [x] Auth.js: password + magic link, roles, rate limiting, instructor invites
- [x] Role-scoped DAL + unit tests

## Phase 1 – MVP  (tag `phase-1`) ✅
- [x] Domain logic with unit tests: hours ledger, `checkSlot` (8 rules + admin overrides), best-fit ranking + explanation factors, derived student status, exam readiness, due-date urgency, calendar layout, ICS and message templates
- [x] **Students**: list with URL filters (All / Practical / Theory only / Exam soon / Low hours / Manual / Automatic / Waiting list), search by name or phone, detail panel (gearbox toggle, hours ring, editable availability grid, skills, exam status), full profile with tabs (Lessons, Payments, Exams, Notes), add/edit form (react-hook-form + shared Zod schema), one-off unavailability
- [x] **Instructors**: cards, working-hours editor (several blocks per day), time off, default car, max minutes per day, invite by e-mail, deactivate
- [x] **Vehicles**: cards with Dutch plate, APK / service / insurance urgency (amber ≤ 30 days, red overdue), unavailability blocks, CRUD
- [x] **Packages**: CRUD (price changes only affect new purchases); admin can sell a package to a student (PURCHASE ledger entry)
- [x] **Hours ledger**: append-only, cached balances updated in the same transaction, admin hour adjustment with reason + audit log
- [x] **Book a lesson** wizard (state in URL): student → type/duration → date strip → ranked time slots with reasons, "Beste keuze" + explanation, pickup, repeat weekly, car auto-assigned, hours-after bar, day overview, admin overrides (with reason, audited), theory group enrolment, CBR exam lessons
- [x] **Lessons** page: filters (status, type, instructor, dates, needs check-off), lesson sheet (edit time/car/pickup with conflict re-check, complete with skill sliders, no-show, cancel with chargeable logic from the cancellation window, notes, theory attendance), bulk check-off
- [x] **Calendar**: day/week grid Mon–Sat 08–20, 15-minute drag & drop (dnd-kit) for moving lessons and for dragging students from the "To schedule" panel, live "fits availability" feedback, availability highlighting, blocked time ("Vrij vanaf 12:30"), per-day hour totals, instructor filter, legend, AI-rules panel; server re-validates every drop
- [x] **Dashboard**: greeting, KPIs, today's lessons, upcoming exams with readiness, running-low card with "Stuur aanvulling", lessons to check off, APK alerts; instructor sees "Mijn uren" and no money
- [x] **E-mail confirmations** (+ ICS attachment) in the student's language, SMS via mock provider, queued 24 h reminders, everything logged in `Notification`
- [x] Playwright suite (login, roles, language switch, booking, drag & drop, refusal feedback, check-off, cancellation policy) on an isolated test database
- [x] Edit, archive and permanently delete a student (delete: admin only, blocked when invoices exist)
- [x] Student address: province → city/village → wijk lists (all of the Netherlands) and address suggestions after choosing a province
- [x] Netherlands-only students (Dutch phone in +31 format, e-mail, province + city required); Shaakir is the default primary instructor
- [x] Student age rule: date of birth required, at least 18 years
- [ ] Moved to later phases: month view + recurring-lesson management UI (Phase 4), AI banner/generator (Phase 3), search ⌘K + bell (Phase 4), mobile sidebar drawer (Phase 4), accountant PDF report (Phase 4)

## Phase 2 – Money  (tag `phase-2`) ✅
- [x] **Invoices**: created when a package is sold (prices include 21 % VAT, total always equals the package price), sequential number per year (2026-0142, atomic), due date from the payment term (14 days), status OPEN → PARTIALLY_PAID → PAID / OVERDUE / VOID
- [x] **Invoice PDF** (@react-pdf/renderer): Dutch-compliant (number, dates, KvK, BTW number, IBAN, customer details, VAT breakdown, paid/void stamp), in the student's language; stored in `storage/`; download button, e-mail attachment
- [x] **Mollie iDEAL**: payment link per invoice for the amount still owed; webhook `/api/webhooks/mollie` re-fetches the payment and updates idempotently; return page `/pay/return`; without a Mollie key a local **mock checkout** (`/pay/mock/…`) lets you walk through the whole flow
- [x] **Manual payments** (cash, pin, bank transfer) with over-payment protection; void an unpaid invoice (takes the unused hours back)
- [x] **Payments & hours page** (mockup 5): KPIs, student balances with the right action per row (view invoice / send top-up / send iDEAL link / send reminder), filters, revenue chart, packages, "Send all reminders" with a confirm list, accountant CSV export
- [x] **Invoice detail**: lines, VAT breakdown, payment history, reminders sent, mark as paid, copy iDEAL link, send invoice, void
- [x] **Top-up** ("Stuur aanvulling"): choose a package → invoice + iDEAL link by SMS/e-mail (consent respected)
- [x] **SMS**: provider interface with Twilio and Bird implementations (REST, no SDK) and a console mock; sender name from Settings
- [x] **Jobs** (`/api/cron/run`, secret-protected, idempotent): due 24 h lesson reminders, overdue invoices, automatic payment reminders (after 3 and 10 days), nightly ledger check (repairs drift and alerts admins); "Run now" button in Settings
- [x] **Booking rule**: no new lessons while an invoice is overdue (setting `allowBookingOnUnpaid`), admin can override with a reason; the booking wizard's admin overrides now really unlock slots
- [x] Tests: money rules, providers (fake network), PDF rendering, CSV, overdue rule, 11 end-to-end money flows

### Known issues / notes
- Date inputs (`type=date`, `datetime-local`) follow the browser/OS locale; time of day in lesson and working-hour forms uses a 24 h text field.
- Theory groups cannot be created from the UI yet (seeded); group management comes in Phase 4.
- The Dev server (`npm run dev`) on OneDrive may serve stale CSS after style changes; stop it, delete `.next`, restart.
- Real e-mail needs RESEND_API_KEY, real iDEAL needs MOLLIE_API_KEY and a public APP_URL, real SMS needs SMS_PROVIDER plus its keys; without them everything runs in test/mock mode (see README).
- Vercel Hobby runs the cron job once a day; for exact 24 h reminders call `/api/cron/run` every 15 minutes from Vercel Pro or any external scheduler.
