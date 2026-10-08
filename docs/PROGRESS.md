# Progress

## Phase 0 – Foundation
- [x] Git repo, `.gitignore`, `.env.example`, `docker-compose.yml`, GitHub Actions CI
- [x] Next.js 16 + TypeScript strict + Tailwind 4, design tokens from the mockups
- [x] App shell: sidebar (role-based nav), top bar (date/week, search, bell, generate button), user menu
- [x] i18n NL/EN (`next-intl`), language switcher (cookie + saved on user), key-parity test
- [x] Intl formatting helpers (dates, 24h time, EUR, hours), ISO weeks, Europe/Amsterdam DST handling + tests
- [x] Prisma schema (all entities from the prompt), migrations incl. exclusion constraints + append-only ledger
- [x] Seed with mockup data (2 instructors, 3 cars, 20 students, lessons, theory groups, exams, invoices)
- [x] Auth.js: password + magic link, roles, rate limiting, instructor invites (action + accept page)
- [x] Role-scoped DAL (`src/lib/dal`) + unit tests
- [ ] Dashboard content (Phase 1) · Instructeurs invite UI (Phase 1)
- [ ] Mobile sidebar (collapsible drawer) — Phase 4 responsive pass
- [ ] Playwright config/tests — start with Phase 1 flows

### Known issues
- Dev machine has no Docker; verified against a local PostgreSQL 18 instance instead.
- Top-bar search, bell and "Planning genereren" buttons are visual only until Phases 3–4.
