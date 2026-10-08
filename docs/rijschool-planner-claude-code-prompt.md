# Build: RijSchool Planner — Driving School Management System

You are building a production-quality web app from scratch: **RijSchool Planner**, a management system for the Dutch driving school **Shaakir Rijschool** in Rotterdam (owner: Shaakir). "RijSchool Planner" is the app/product name; "Shaakir Rijschool" is the school name shown in the sidebar under the logo, on invoices, e-mails, SMS, PDFs and reports. Read this whole prompt before starting. Work **phase by phase** (see "Build phases" at the bottom). At the end of each phase: run lint, type-check and tests, commit, give me a short summary of what's done and how to try it, and **wait for my "go" before starting the next phase**.

## 0. Design reference

The UI design is in `docs/mockups/RijSchool-Planner-mockups.pdf` (6 screens: Dashboard, Weekly schedule/Calendar, Students, Book a lesson, Payments & remaining hours, Reports). **Open it and match it closely**: layout, spacing, colors, card style, badges, typography. Render the pages to images if needed to inspect them. Where this prompt and the mockups disagree on visuals, follow the mockups. Screens not in the mockups (Instructors, Vehicles, Lessons, Settings, Login) must be designed in the same visual style.

Visual language from the mockups:
- Left sidebar: "SR" logo tile + "RijSchool Planner" with "Shaakir Rijschool" underneath, nav items with icons, active item highlighted in light blue; user card at the bottom ("Shaakir · Owner · Instructor").
- Top bar: small date/week label above a large page title, search field, notification bell, primary button **"Generate schedule"** (sparkle icon) on every page.
- Light grey page background (#F4F5F7), white rounded cards (rounded-2xl, subtle border), Inter font.
- Colors: primary royal blue `#1D4ED8`; Theory = orange/amber; CBR exam = navy `#0F172A`; AI draft = dashed blue outline on light blue; "AUT" small badge = automatic gearbox lesson; warnings amber; overdue red.
- KPI cards: label + small icon top-right, large number, small grey sub-text. One highlighted KPI may be solid blue.

## 1. Language: Dutch + English (required)

The app must be fully bilingual: **Dutch (nl) is the default language**, English (en) is the second.
- Use `next-intl`. All UI text lives in `messages/nl.json` and `messages/en.json`. **No hard-coded user-facing strings in components.**
- Language switcher (NL / EN) in the user menu in the sidebar; store the choice per user in the database and in a cookie. Login page has the switcher too.
- Format dates, times, numbers and currency with `Intl` using `nl-NL` / `en-GB`: e.g. "maandag 28 september 2026", "€ 1.240,00" in Dutch. Week numbers are ISO weeks ("Week 40"). 24-hour clock in both languages.
- Time-based greeting in the dashboard: "Goedemorgen / Goedemiddag / Goedenavond, Shaakir" (NL) and "Good morning / afternoon / evening" (EN).
- Use proper Dutch driving-school terminology, for example:
  - Lesson = Les, Practical lesson = Praktijkles, Theory = Theorie, Exam = Examen, CBR exam = CBR-examen, Practical exam = Praktijkexamen, Theory exam = Theorie-examen, Interim test = Tussentijdse toets (TTT)
  - Student = Leerling, Instructor = Instructeur, Vehicle/Car = Lesauto, Manual = Schakel, Automatic = Automaat, Licence plate = Kenteken, APK = APK
  - Book a lesson = Les inplannen, Calendar = Agenda, Payments & hours = Betalingen & uren, Reports = Rapportages, Dashboard = Dashboard, Settings = Instellingen
  - Remaining hours = Resterende uren, Package = Pakket, Invoice = Factuur, Outstanding = Openstaand, Overdue = Te laat / Achterstallig, Paid = Betaald, Partially paid = Deels betaald
  - Generate schedule = Planning genereren, Approve & notify students = Goedkeuren & leerlingen informeren, Discard = Verwerpen, Best fit = Beste keuze, No-show = Niet verschenen, Waiting list = Wachtlijst
- **All outgoing messages to students (SMS, e-mail, invoices, PDFs) are sent in the student's preferred language** (field on Student, default `nl`). Invoices and the accountant report are Dutch by default.
- Add a test/lint check that fails if a key exists in one message file but not the other.

## 2. Users & roles

- **Admin** (owner): sees and manages everything.
- **Instructor**: sees only their own schedule, their own students (assigned or with lessons together), can book/move/complete their own lessons and update skills. **No access to payments, reports, packages, settings, other instructors.** They may see a student's paid/unpaid status but not amounts.
- The owner is both Admin and Instructor (one User linked to one Instructor record).
- Students do **not** log in in v1 (portal is a later phase).
- Enforce roles server-side in a single data-access layer (`src/lib/dal/*`): every query for an instructor is scoped by their instructorId. Never rely on hiding UI alone.
- Login: email + password and magic link; admin invites instructors by email.

## 3. Tech stack

- Next.js (App Router, latest stable) + TypeScript (strict)
- Tailwind CSS + shadcn/ui (Radix) + lucide-react icons + Inter (next/font)
- PostgreSQL + Prisma (add raw SQL migration for exclusion constraints)
- Auth.js (NextAuth v5) with roles
- react-hook-form + Zod (shared schemas for client and server actions)
- Server Components + Server Actions; TanStack Query only for the interactive calendar and booking wizard
- Calendar: custom week grid with `@dnd-kit/core` (15-minute snapping). Time-box it; fall back to FullCalendar if it becomes too costly, but keep the mockup look.
- Charts: Recharts (shadcn charts)
- next-intl for i18n
- Background jobs: Inngest or Trigger.dev (or a DB job table + cron route)
- Payments: Mollie (iDEAL), SMS: adapter interface with Twilio and Bird implementations, Email: Resend + React Email, PDF: @react-pdf/renderer, CSV export
- Tests: Vitest (domain logic) + Playwright (key flows)
- Hosting target: Vercel EU region + Neon/Supabase Postgres EU. Provide `.env.example` and a `docker-compose.yml` for local Postgres.

Conventions:
- Money = integer cents. Durations = integer minutes. Timestamps = `timestamptz` in UTC, displayed in `Europe/Amsterdam` (handle DST correctly, add tests).
- Every table has `schoolId` (single school now, multi-tenant-ready later).
- All external providers (Mollie, SMS, email) behind interfaces with a **console/mock implementation** used when API keys are missing, so the app runs fully locally without accounts.

## 4. Data model (implement in `prisma/schema.prisma`)

- **School**: name, address, KvK, BTW number, IBAN, timezone, logo, defaultLocale, settings JSON (max teaching minutes/day = 480, travel buffer, cancellation window hours = 24, reminder toggles, allowBookingOnUnpaid, VAT rate).
- **User**: email, name, phone, passwordHash?, role (ADMIN | INSTRUCTOR), locale (nl | en), isActive. Optional 1–1 Instructor.
- **Instructor**: user, displayName, color, licence/WRM number, maxMinutesPerDay, home base address + lat/lng, defaultVehicleId?, active.
- **InstructorWorkingHours** (weekday, start, end; multiple per day allowed), **InstructorTimeOff** (startsAt, endsAt, reason).
- **Student**: names, phone, email, birth date, address, postcode, area (wijk, e.g. Kralingen), lat/lng, gearbox (MANUAL | AUTOMATIC), track (PRACTICAL | THEORY_ONLY | BOTH), status (WAITING_LIST | ACTIVE | PAUSED | PASSED | ARCHIVED), primaryInstructorId?, since date, notes, SMS/email consent, locale (nl | en, default nl), CBR candidate number?, avatar color, parent/guardian contact (optional, for under-18s).
- **StudentAvailability** (weekday × MORNING 08–12 / AFTERNOON 12–17 / EVENING 17–20, optional exact times), **StudentUnavailability** (one-off).
- **Package** (catalogue): name (nl + en), type (PRACTICAL | THEORY | EXAM_BUNDLE), lessonCount, minutesIncluded, includesExam, priceCents, vatRate, isPopular, active, sortOrder. Seed: Losse les 60 min €62; 10 lessen €595; 20 lessen €1.150; 30 lessen + examen €1.890 (Meest gekozen); Theoriecursus 6 klassikale lessen €149.
- **StudentPackage**: student, package, purchasedAt, priceCents snapshot, minutesPurchased, examCredits, status, invoice.
- **HoursLedgerEntry** (append-only, source of truth): student, studentPackage?, lesson?, type (PURCHASE | RESERVE | RELEASE | CONSUME | ADJUST | REFUND), minutes (signed), note, createdBy. Cache `minutesRemaining` / `minutesReserved` on Student, updated in the same transaction.
- **Lesson**: type (PRACTICAL | THEORY | EXAM), instructor, student?, theoryGroup?, vehicle?, startsAt, endsAt, durationMin, gearbox, pickup address + lat/lng, status (DRAFT | PLANNED | COMPLETED | NO_SHOW | CANCELLED_STUDENT | CANCELLED_SCHOOL), cancellationReason, chargeable, source (MANUAL | AI | RECURRING), scheduleDraft?, recurrenceRule?, instructor notes, notes for student, completedAt. Postgres exclusion constraints: no overlapping active lessons per instructor and per vehicle.
- **RecurrenceRule** (weekly, count/until).
- **TheoryGroup** (title nl/en, topic, startsAt, endsAt, location, capacity 10, instructor) + **TheoryEnrollment** (attendance ENROLLED | ATTENDED | NO_SHOW).
- **Exam**: student, kind (THEORY | PRACTICAL | TUSSENTIJDSE_TOETS), scheduledAt, cbrLocation, lesson?, status (REQUESTED | SCHEDULED | PASSED | FAILED | CANCELLED), attemptNumber, readiness (READY | NEEDS_LESSONS), lessonsLeftEstimate, notes.
- **Skill** (catalogue, nl/en names: Voertuigbeheersing / Vehicle control, Rotondes & voorrang / Roundabouts & priority, Snelwegrijden / Highway driving, Bijzondere verrichtingen / Special manoeuvres; extensible), **SkillProgress** (0–100), **SkillAssessment** (history per lesson).
- **Vehicle**: name/model, kenteken, gearbox, color, dual control, status (ACTIVE | IN_MAINTENANCE | RETIRED), apkDueDate, nextServiceDate, insuranceDueDate, odometerKm, assignedInstructorId? + **VehicleUnavailability**.
- **Invoice** (sequential number per year e.g. 2026-0142, lines, subtotal, VAT, total, status DRAFT | OPEN | PARTIALLY_PAID | PAID | OVERDUE | VOID, dueDate, pdfUrl), **Payment** (method IDEAL | BANK_TRANSFER | CASH | PIN, Mollie ids, checkout URL, status, paidAt), **PaymentReminder**.
- **ScheduleDraft** (date, instructor, status PENDING_REVIEW | APPROVED | DISCARDED | PARTIALLY_APPROVED, stats, explanation, generatedAt, reviewedAt) + **ScheduleDraftItem** (original slot, outcome KEPT | MOVED | REMOVED).
- **Notification** (outbound log: channel SMS | EMAIL, template, locale, status, provider id, scheduledFor, sentAt, error), **InAppNotification** (bell), **AuditLog**.

Create a rich **seed script** using the names and numbers from the mockups (Shaakir as owner-instructor; students Daan de Vries, Sanne Bakker, Emma Visser, Lars Mulder, Mohammed El Amrani, Lotte Jansen, Kim Hendriks, Fatima Ouali, Jesse Meijer, Yusuf Demir, Noah Smit, Bram Peters, etc.; Rotterdam areas Kralingen, Blijdorp, Delfshaven, Hillegersberg, Rotterdam Centraal; 2 manual cars + 1 automatic; a second instructor; lessons this week; theory groups; exams; invoices in mixed states) so every screen looks like the mockups on first run. The seeded School record is named **Shaakir Rijschool** (Rotterdam, timezone Europe/Amsterdam, default language nl); leave KvK, BTW and IBAN as placeholders to fill in Settings. The school name is always read from the database (editable in Settings), never hard-coded.

## 5. Pages

Sidebar for **Admin**: Dashboard, Agenda, Leerlingen, Les inplannen, Lessen, Betalingen & uren, Rapportages; section "Beheer": Instructeurs, Lesauto's, Pakketten, Instellingen. **Instructor**: Dashboard, Agenda, Mijn leerlingen, Les inplannen, Lessen.

Global: top bar with date/week label, title, ⌘K global search (students, lessons, invoices), notification bell (popover), "Planning genereren" button (dialog: date(s), instructor, constraint preview).

1. **Dashboard** (mockup 1): greeting + date + week; blue AI banner when tomorrow isn't planned ("Morgen is nog niet ingepland. Laat AI het in een minuut opstellen") with chips (students available, open practical slots, theory groups, exam-prep note), "Genereer morgen" button and "Jij controleert, sleept & keurt goed" link. KPI cards: Lessen vandaag, Actieve leerlingen, Ingepland deze week (hours + % capacity bar), Openstaande betalingen (admin; instructor sees "Mijn uren deze week"). Today's lessons list (time, duration, avatar, name, gearbox · area · lesson N of M, type tag, AUT badge, status Next up/Upcoming; theory rows show seats). Upcoming CBR exams card with readiness badge. "Bijna door uren heen" (running low on hours) card with "Stuur aanvulling" (top-up) button. Also a "lessons to check off" reminder for past lessons not yet completed, and APK-due alerts for vehicles.
2. **Agenda / Calendar** (mockup 2): Day/Week/Month, prev/today/next, instructor filter (admin), legend. AI draft banner with Verwerpen / Goedkeuren & leerlingen informeren. Left "In te plannen" panel with draggable student cards (duration, gearbox, availability text, hours bar). Week grid Mon–Sat 08:00–20:00, per-day hour totals, blocked time ("Vrij vanaf 12:30"), student availability highlight while dragging, "✓ Past in beschikbaarheid" / red reason indicator on drag, server re-validates on drop. Click a lesson → side sheet. "AI-planningsregels" panel listing the 6 rules (configurable by admin).
3. **Leerlingen / Students** (mockup 3): header counts (active · waiting list), search by name/phone, Add student. Filter chips (All, Practical, Theory only, Exam soon, Low hours, Manual n, Automatic n) in URL. Table: student + gearbox + package, remaining-hours bar, availability day pills, next lesson, status badge (priority: Exam requested > CBR exam {day} > Theory exam {date} > Low hours > Unscheduled > Theory only > Active). Right detail panel exactly as mockup: Book lesson / Message, Learns in Manual/Automatic, hours ring, weekly availability grid (editable), skills progress, theory/practical exam status. Full page `/leerlingen/[id]` adds tabs: Lessons, Payments, Exams, Notes.
4. **Les inplannen / Book a lesson** (mockup 4): wizard with state in URL: 1 student, 2 type (Praktijk/Theorie/CBR-examen) + duration 60/90/120 (disable durations above remaining hours), 3 date strip with availability dots, 4 time slots with conflicts shown disabled with reasons ("Botst met Julia", "Theoriegroep", "Kim niet beschikbaar", "Geen automaat vrij"), "Beste keuze" slot + explanation line, pickup location (default student address), repeat weekly. Right: booking summary (student, lesson, when, car auto-assigned & overridable, pickup), hours-after-booking bar (8 u → 6,5 u), checkboxes SMS & e-mail confirmation, reminder 24h before, Confirm booking. "Woensdag in één oogopslag" day list with day total vs 8 u max.
5. **Lessen / Lessons** (new): table with filters (status, instructor, date range, type, "needs check-off"). Lesson sheet/detail: edit time/car/pickup (re-check conflicts), mark Completed / No-show / Cancelled (reason + chargeable, default by cancellation window), notes, skill sliders, theory attendance checklist, bulk check-off.
6. **Betalingen & uren / Payments** (mockup 5, admin only): Export for accountant, Send all reminders (confirm list). KPIs: received this month (+% vs last month), outstanding, prepaid hours to teach, under 3 hours left. Balances table with filters All/Unpaid/Low hours, status badges and context actions (View invoice, Send top-up, Send iDEAL link, Send reminder). Revenue bar chart last 6 months. Packages list with "Edit prices" (affects new purchases only). Invoice detail with PDF, payment history, manual "mark as paid".
7. **Rapportages / Reports** (mockup 6, admin only): Week/Month/Quarter/Year, Export CSV, Accountant report (PDF). KPIs: revenue, hours taught (practical/theory), CBR pass rate 1st attempt, prepaid hours still owed (+ € received in advance). Stacked bar hours per week (planned future week dashed). CBR exam results donut + list. No-shows & cancellations (hours lost). AI scheduling stats (days generated, % kept as drafted, lessons moved, avg review time).
8. **Instructeurs** (new, admin): cards (avatar, role, hours this week, students, default car); detail with invite/deactivate, working-hours editor, time off, assigned students, max hours/day.
9. **Lesauto's / Vehicles** (new, admin): cards with model, yellow Dutch kenteken-style plate, Schakel/Automaat badge, status, APK/service dates (amber ≤30 days, red overdue), assigned instructor, lessons this week; detail with unavailability blocks and edit form.
10. **Pakketten** and **Instellingen** (admin): packages CRUD; school details (invoice header, KvK, BTW, IBAN), scheduling rules, cancellation policy, notification templates per language, integration status, users, default language.
11. **Login / invite** pages with language switcher.

## 6. Business logic (put in `src/lib/domain/`, pure functions + unit tests)

**Hours ledger**
- Buying a package → PURCHASE +minutes.
- Booking → RESERVE −duration; reject if available < duration (admin override with reason → ADJUST + audit log).
- Completed → RELEASE + CONSUME. No-show or cancellation inside the window (default 24h) → chargeable → CONSUME; otherwise RELEASE.
- AI DRAFT lessons don't reserve hours; approval reserves them in one transaction.
- Exam lessons use `examCredits` if the package includes the exam, otherwise add an invoice line.
- All mutations in a transaction; nightly job recomputes balances from the ledger and alerts on drift.

**Conflict check** `checkSlot(input) → { ok, conflicts[] }` (shared by booking, drag-drop, editing and the scheduler; each conflict has a translatable reason key + params):
1. Inside instructor working hours, not in time off.
2. No instructor overlap (lessons, theory groups, exams) incl. travel buffer.
3. Inside student availability, not in student unavailability (admin may override → flagged).
4. No student overlap.
5. Enough available hours.
6. A vehicle with matching gearbox is ACTIVE, not unavailable, not double-booked, APK not expired (prefer instructor's default car).
7. Instructor's day total + duration ≤ maxMinutesPerDay (480).
8. Travel feasible from previous lesson's location (haversine × urban factor in v1).
DB exclusion constraints are the final guard; map their errors to friendly translated messages.

**Best-fit scoring**: candidates every 15 min, filtered by `checkSlot`, scored on: adjacency to other lessons, short travel from previous/to next lesson, avoiding unusable gaps < 60 min, center of the student's availability window / usual time, same car & instructor continuity, balanced day load. Top slot = "Beste keuze". Explanation sentence built from the top 2–3 factors using translated templates (NL/EN), e.g. "11:30 is het enige ochtendslot waar 90 min past en de automaat vrij is. Daans les eindigt in Kralingen, 6 minuten van Kims ophaaladres, dus geen lege kilometers."

**AI schedule generation** (per instructor, per day or range):
- Demand list: active students with hours left and no lesson that day; priority: exam soon > hours left vs time to exam > days since last lesson > waiting time.
- Place fixed blocks (theory, exams, time off, existing lessons), then greedy best-fit per student, then a local-search improvement pass (swaps/shifts to reduce travel and gaps).
- Hard rules always enforced: within student availability, never exceed remaining hours, manual/automatic car matched, max 8 teaching hours/day, short drives between pickups, exam candidates first.
- Output a ScheduleDraft with DRAFT lessons (dashed in calendar), stats, and reasons for students left out.
- Optional: if `ANTHROPIC_API_KEY` is set, call the Claude API only to write a short summary text of the draft (pseudonymised data, in the user's language). The LLM never decides the schedule; fall back to templates.
- Flow: Generate → review/drag in calendar (items marked MOVED/REMOVED) → **Approve & notify** (one transaction: re-validate, set PLANNED, reserve hours, mark draft APPROVED, queue SMS/e-mail confirmations + 24h reminders in each student's language). Partial approval allowed. Discard removes drafts but keeps stats. One pending draft per instructor per day.

**Lessons & skills**: completing a lesson prompts skill updates (SkillAssessment history, SkillProgress latest). Exam readiness: all core skills ≥ 80% → Ready; else estimate lessons left from average progress per lesson; instructor can override.

**Derived statuses/KPIs** defined once in `src/lib/queries/*` and reused by all pages (Low hours = available < 180 min; Overdue = OPEN and past due date). Weekly aggregation by ISO week in Europe/Amsterdam.

## 7. Integrations

- **Mollie iDEAL**: payment per invoice/outstanding amount, send checkout link via SMS/e-mail ("Stuur iDEAL-link", "Stuur aanvulling"); webhook `/api/webhooks/mollie` re-fetches the payment and updates idempotently. Test mode in dev.
- **SMS**: provider interface (Twilio + Bird); sender name "ShaakirRS" (alphanumeric SMS senders are max 11 characters; configurable in Settings); e-mails sent from "Shaakir Rijschool"; templates in NL and EN: confirmation, change, cancellation, 24h reminder, payment link, payment reminder. Respect consent; log everything.
- **E-mail**: Resend + React Email, NL/EN templates, ICS attachment on lesson confirmations.
- **PDF**: Dutch-compliant invoices (sequential number, KvK, BTW, VAT breakdown, customer details) and the accountant report (revenue, VAT summary, outstanding debtors, prepaid-hours liability). Language: student's language for invoices, Dutch for accountant report.
- **CSV**: semicolon-separated with UTF-8 BOM (opens correctly in Dutch Excel).
- **Address lookup (optional)**: PDOK Locatieserver (free Dutch postcode → address + coordinates).
- **CBR**: no API; exams are entered manually.

## 8. Quality requirements

- Responsive: desktop-first, works on tablet; sidebar collapses on small screens.
- Accessible: keyboard navigation, focus states, labels, sufficient contrast.
- Loading skeletons, empty states, error boundaries, toast feedback on every action; confirm dialogs for destructive/bulk-send actions.
- Unit tests for ledger, checkSlot, scoring, scheduler, DST handling, i18n key parity. Playwright tests: login, book a lesson, drag in calendar, generate + approve draft, mark lesson completed, send iDEAL link (mock), switch language NL↔EN.
- Security: server-side role checks on every action, Zod validation, rate limiting on login, audit log for hours adjustments and payments. GDPR (AVG): data export & delete for a student, never store BSN.
- README: setup, env vars, seed, run, test, deploy to Vercel EU.

## 9. Defaults (I'll confirm later — make them configurable in Settings)

- Cancellation within 24h and no-shows consume the lesson hours.
- Prices include 21% BTW.
- Payment term 14 days; reminders after 3 and 10 days overdue.
- Students may not book beyond purchased hours unless admin overrides.
- 1 lesson in a package = 60 minutes; a 90-minute lesson uses 1.5 lessons.

## 10. Build phases (stop after each one for my approval)

- **Phase 0 – Foundation**: project setup, design tokens matching mockups, app shell (sidebar, top bar), i18n NL/EN with language switcher, auth + roles + invites, Prisma schema + seed, role-scoped DAL, CI, docker-compose for Postgres.
- **Phase 1 – MVP**: Students (+ availability, filters, detail panel), Instructors, Vehicles, Packages, hours ledger, Lessons (status, check-off, notes, skills), `checkSlot`, Book-a-lesson wizard with best-fit, Calendar (day/week, drag & drop, to-schedule panel), Dashboard, e-mail confirmations.
- **Phase 2 – Money**: invoices + PDF, Mollie iDEAL, manual payments, Payments & hours page, SMS, 24h reminders and overdue jobs.
- **Phase 3 – AI scheduling**: generator, draft review/approve/notify, dashboard AI banner, rules settings, explanations.
- **Phase 4 – Reports & polish**: Reports page, CSV + accountant PDF, global search, notification bell, month view, recurring lessons, theory groups + attendance, responsive pass, complete NL/EN translation review.

Start with Phase 0. First, show me your short plan for Phase 0 and the folder structure, then build it.
