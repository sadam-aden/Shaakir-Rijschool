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
- [x] Student age rule: date of birth required, at least 18 years
- [ ] Moved to later phases: month view + recurring-lesson management UI (Phase 4), AI banner/generator (Phase 3), invoices/iDEAL/SMS providers/reminder job (Phase 2), search ⌘K + bell (Phase 4), mobile sidebar drawer (Phase 4)

### Known issues / notes
- Date inputs (`type=date`, `datetime-local`) follow the browser/OS locale; time of day in lesson and working-hour forms uses a 24 h text field.
- Theory groups cannot be created from the UI yet (seeded); group management comes in Phase 4.
- The Dev server (`npm run dev`) on OneDrive may serve stale CSS after style changes; stop it, delete `.next`, restart.
