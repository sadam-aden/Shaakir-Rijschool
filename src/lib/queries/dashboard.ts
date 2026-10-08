import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { lessonScope, studentScope } from "@/lib/dal/scope";
import { dueState } from "@/lib/domain/due";
import { localDateKey, startOfIsoWeek, zonedToUtc } from "@/lib/domain/time";
import { getSchoolSettings } from "./settings";
import { getStudentRows } from "./students";

const DAY = 86_400_000;

export async function getDashboard(user: SessionUser, locale: "nl" | "en") {
  const now = new Date();
  const dayKey = localDateKey(now);
  const [y, m, d] = dayKey.split("-").map(Number);
  const todayStart = zonedToUtc(y, m, d, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + DAY);
  const weekStart = startOfIsoWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
  const monthStart = zonedToUtc(y, m, 1, 0, 0);
  const monthEnd = zonedToUtc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, 0, 0);
  const { settings } = await getSchoolSettings(user.schoolId);
  const isAdmin = user.role === "ADMIN";

  const activeLesson = { in: ["PLANNED", "COMPLETED", "NO_SHOW"] as ("PLANNED" | "COMPLETED" | "NO_SHOW")[] };

  const [todayLessons, weekLessons, checkOff, instructors, studentRows, exams, plannedPerStudent, vehicles, invoices] = await Promise.all([
    db.lesson.findMany({
      where: { ...lessonScope(user), status: activeLesson, startsAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { startsAt: "asc" },
      include: {
        student: { select: { firstName: true, lastName: true, area: true, gearbox: true, minutesRemaining: true, packages: { where: { status: "ACTIVE" }, select: { minutesPurchased: true } } } },
        theoryGroup: { select: { titleNl: true, titleEn: true, capacity: true, _count: { select: { enrollments: true } } } },
      },
    }),
    db.lesson.findMany({ where: { ...lessonScope(user), status: activeLesson, startsAt: { gte: weekStart, lt: weekEnd } }, select: { durationMin: true, type: true } }),
    db.lesson.findMany({
      where: { ...lessonScope(user), status: "PLANNED", endsAt: { lt: now } }, orderBy: { startsAt: "desc" }, take: 5,
      include: { student: { select: { firstName: true, lastName: true } }, theoryGroup: { select: { titleNl: true, titleEn: true } } },
    }),
    db.instructor.findMany({
      where: { schoolId: user.schoolId, active: true, ...(isAdmin ? {} : { id: user.instructorId ?? "__none__" }) },
      select: { maxMinutesPerDay: true, workingHours: true },
    }),
    getStudentRows(user),
    db.exam.findMany({
      where: { schoolId: user.schoolId, status: "SCHEDULED", scheduledAt: { gte: now }, student: studentScope(user) },
      orderBy: { scheduledAt: "asc" }, take: 3, include: { student: { select: { firstName: true, lastName: true } } },
    }),
    db.lesson.groupBy({ by: ["studentId"], where: { ...lessonScope(user), status: "PLANNED", startsAt: { gte: now } }, _count: true }),
    db.vehicle.findMany({ where: { schoolId: user.schoolId, status: { not: "RETIRED" } }, select: { id: true, name: true, apkDueDate: true } }),
    isAdmin
      ? db.invoice.findMany({ where: { schoolId: user.schoolId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] } }, include: { payments: { where: { status: "PAID" } } } })
      : Promise.resolve([]),
  ]);

  // ── KPIs ──
  const todayPractical = todayLessons.filter((l) => l.type !== "THEORY").length;
  const todayTheory = todayLessons.filter((l) => l.type === "THEORY").length;
  const todayMinutes = todayLessons.reduce((a, l) => a + l.durationMin, 0);
  const plannedWeekMinutes = weekLessons.reduce((a, l) => a + l.durationMin, 0);
  // weekly capacity: working hours Mon–Sat, each day capped by the instructor's daily maximum
  let capacityMinutes = 0;
  for (const ins of instructors) {
    for (let wd = 1; wd <= 6; wd++) {
      const mins = ins.workingHours.filter((w) => w.weekday === wd).reduce((a, w) => a + (w.endMin - w.startMin), 0);
      capacityMinutes += Math.min(mins, ins.maxMinutesPerDay, settings.maxTeachingMinutesPerDay);
    }
  }
  const active = studentRows.rows.filter((r) => r.status === "ACTIVE");
  const examsThisMonth = await db.exam.count({
    where: { schoolId: user.schoolId, kind: "PRACTICAL", status: "SCHEDULED", scheduledAt: { gte: monthStart, lt: monthEnd }, student: studentScope(user) },
  });

  let outstandingCents = 0;
  let openInvoices = 0;
  let overdueInvoices = 0;
  for (const inv of invoices) {
    const due = inv.totalCents - inv.payments.reduce((a, p) => a + p.amountCents, 0);
    if (due <= 0) continue;
    outstandingCents += due;
    openInvoices++;
    if (inv.dueDate < todayStart) overdueInvoices++; // overdue = still open and past its due date
  }

  // ── today list ──
  const nextUp = todayLessons.find((l) => l.status === "PLANNED" && l.endsAt > now)?.id;
  const today = todayLessons.map((l) => {
    const purchased = l.student?.packages.reduce((a, p) => a + p.minutesPurchased, 0) ?? 0;
    const consumed = purchased - (l.student?.minutesRemaining ?? 0);
    return {
      id: l.id, startsAt: l.startsAt, durationMin: l.durationMin, type: l.type, status: l.status, isNext: l.id === nextUp, past: l.endsAt <= now,
      name: l.theoryGroup ? (locale === "nl" ? l.theoryGroup.titleNl : l.theoryGroup.titleEn) : `${l.student?.firstName ?? ""} ${l.student?.lastName ?? ""}`.trim(),
      initials: `${l.student?.firstName?.[0] ?? ""}${l.student?.lastName?.[0] ?? ""}`,
      gearbox: l.gearbox, area: l.student?.area ?? null, note: l.instructorNotes,
      lessonNo: purchased > 0 ? Math.min(Math.floor(consumed / 60) + 1, Math.round(purchased / 60)) : null,
      lessonTotal: purchased > 0 ? Math.round(purchased / 60) : null,
      seats: l.theoryGroup ? { n: l.theoryGroup._count.enrollments, cap: l.theoryGroup.capacity } : null,
    };
  });

  // ── low hours ──
  const plannedCount = new Map(plannedPerStudent.map((p) => [p.studentId, p._count]));
  const lowHours = active
    .filter((r) => r.track !== "THEORY_ONLY" && r.minutesAvailable < settings.lowHoursMinutes && r.minutesPurchased > 0)
    .sort((a, b) => a.minutesAvailable - b.minutesAvailable)
    .slice(0, 4)
    .map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`, minutesAvailable: r.minutesAvailable, planned: plannedCount.get(r.id) ?? 0 }));

  const apkAlerts = vehicles
    .map((v) => ({ id: v.id, name: v.name, state: dueState(v.apkDueDate, now) }))
    .filter((v) => v.state.kind === "overdue" || v.state.kind === "soon" || v.state.kind === "today");

  return {
    kpis: {
      todayPractical, todayTheory, todayMinutes,
      activeStudents: active.length, examsThisMonth,
      plannedWeekMinutes, capacityMinutes,
      outstandingCents, openInvoices, overdueInvoices,
    },
    today, checkOff, apkAlerts, lowHours,
    exams: exams.map((e) => ({
      id: e.id, kind: e.kind, at: e.scheduledAt!, location: e.cbrLocation, readiness: e.readiness, lessonsLeft: e.lessonsLeftEstimate,
      name: `${e.student.firstName} ${e.student.lastName}`,
    })),
    checkOffTotal: await db.lesson.count({ where: { ...lessonScope(user), status: "PLANNED", endsAt: { lt: now } } }),
  };
}
