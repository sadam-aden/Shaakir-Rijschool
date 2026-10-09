import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { studentScope } from "@/lib/dal/scope";
import type { Avail } from "@/lib/domain/availability";
import { deriveStatus, type DerivedStatus } from "@/lib/domain/student-status";
import { getSchoolSettings } from "./settings";

export type StudentFilter = "all" | "practical" | "theoryOnly" | "examSoon" | "lowHours" | "manual" | "automatic" | "waiting" | "archived";

export type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  gearbox: "MANUAL" | "AUTOMATIC";
  track: "PRACTICAL" | "THEORY_ONLY" | "BOTH";
  status: "WAITING_LIST" | "ACTIVE" | "PAUSED" | "PASSED" | "ARCHIVED";
  area: string | null;
  phone: string | null;
  email: string | null;
  avatarColor: string;
  since: Date;
  packageNameNl: string | null;
  packageNameEn: string | null;
  /** package size in minutes (purchased) */
  minutesPurchased: number;
  minutesRemaining: number;
  minutesReserved: number;
  minutesAvailable: number;
  theoryAttended: number;
  theoryTotal: number;
  lessonCount: number;
  availability: Avail[];
  nextLesson: { id: string; startsAt: Date; type: "PRACTICAL" | "THEORY" | "EXAM"; durationMin: number; draft: boolean } | null;
  derived: DerivedStatus;
  examSoon: boolean;
};

const EXAM_SOON_DAYS = 14;

export async function getStudentRows(user: SessionUser): Promise<{ rows: StudentRow[]; lowHoursMinutes: number }> {
  const { settings } = await getSchoolSettings(user.schoolId);
  const now = new Date();
  const students = await db.student.findMany({
    where: { ...studentScope(user), status: { in: ["ACTIVE", "PAUSED", "WAITING_LIST", "PASSED", "ARCHIVED"] } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      availability: true,
      exams: { select: { kind: true, status: true, scheduledAt: true } },
      packages: { where: { status: "ACTIVE" }, orderBy: { purchasedAt: "desc" }, include: { package: true } },
      enrollments: {
        select: { attendance: true, theoryGroup: { select: { id: true, startsAt: true, endsAt: true } } },
      },
      lessons: {
        where: { status: { in: ["PLANNED", "DRAFT"] }, startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { id: true, startsAt: true, type: true, durationMin: true, status: true },
      },
    },
  });

  const rows = students.map((s): StudentRow => {
    const available = s.minutesRemaining - s.minutesReserved;
    const groupNext = s.enrollments
      .filter((e) => e.attendance === "ENROLLED" && e.theoryGroup.startsAt >= now)
      .sort((a, b) => +a.theoryGroup.startsAt - +b.theoryGroup.startsAt)[0]?.theoryGroup;
    const next = s.lessons[0];
    const pkg = s.packages[0];
    const derived = deriveStatus({
      status: s.status, track: s.track, minutesAvailable: available, hasUpcomingLesson: !!next || !!groupNext,
      exams: s.exams, now, lowHoursMinutes: settings.lowHoursMinutes,
    });
    const horizon = now.getTime() + EXAM_SOON_DAYS * 86_400_000;
    const examSoon =
      derived.kind === "examRequested" ||
      s.exams.some((x) => x.status === "SCHEDULED" && x.scheduledAt && x.scheduledAt >= now && +x.scheduledAt <= horizon);
    return {
      id: s.id, firstName: s.firstName, lastName: s.lastName, gearbox: s.gearbox, track: s.track, status: s.status,
      area: s.area, phone: s.phone, email: s.email, avatarColor: s.avatarColor, since: s.since,
      packageNameNl: pkg?.package.nameNl ?? null, packageNameEn: pkg?.package.nameEn ?? null,
      minutesPurchased: s.packages.reduce((a, p) => a + p.minutesPurchased, 0),
      minutesRemaining: s.minutesRemaining, minutesReserved: s.minutesReserved, minutesAvailable: available,
      theoryAttended: s.enrollments.filter((e) => e.attendance === "ATTENDED").length,
      theoryTotal: pkg?.package.type === "THEORY" ? pkg.package.lessonCount : 6,
      lessonCount: Math.round(s.packages.reduce((a, p) => a + p.minutesPurchased, 0) / 60),
      availability: s.availability.map((a) => ({ weekday: a.weekday, part: a.part, startMin: a.startMin, endMin: a.endMin })),
      nextLesson: next
        ? { id: next.id, startsAt: next.startsAt, type: next.type, durationMin: next.durationMin, draft: next.status === "DRAFT" }
        : groupNext
          ? { id: groupNext.id, startsAt: groupNext.startsAt, type: "THEORY" as const, durationMin: Math.round((+groupNext.endsAt - +groupNext.startsAt) / 60000), draft: false }
          : null,
      derived, examSoon,
    };
  });
  return { rows, lowHoursMinutes: settings.lowHoursMinutes };
}

export function filterStudents(rows: StudentRow[], filter: StudentFilter, q: string, lowHoursMinutes: number) {
  const active = rows.filter((r) => r.status === "ACTIVE" || r.status === "PAUSED");
  const counts = {
    all: active.length,
    practical: active.filter((r) => r.track !== "THEORY_ONLY").length,
    theoryOnly: active.filter((r) => r.track === "THEORY_ONLY").length,
    examSoon: active.filter((r) => r.examSoon).length,
    lowHours: active.filter((r) => r.track !== "THEORY_ONLY" && r.minutesAvailable < lowHoursMinutes).length,
    manual: active.filter((r) => r.gearbox === "MANUAL").length,
    automatic: active.filter((r) => r.gearbox === "AUTOMATIC").length,
    waiting: rows.filter((r) => r.status === "WAITING_LIST").length,
    archived: rows.filter((r) => r.status === "ARCHIVED" || r.status === "PASSED").length,
  };
  let list =
    filter === "waiting" ? rows.filter((r) => r.status === "WAITING_LIST")
    : filter === "archived" ? rows.filter((r) => r.status === "ARCHIVED" || r.status === "PASSED")
    : active;
  switch (filter) {
    case "practical": list = list.filter((r) => r.track !== "THEORY_ONLY"); break;
    case "theoryOnly": list = list.filter((r) => r.track === "THEORY_ONLY"); break;
    case "examSoon": list = list.filter((r) => r.examSoon); break;
    case "lowHours": list = list.filter((r) => r.track !== "THEORY_ONLY" && r.minutesAvailable < lowHoursMinutes); break;
    case "manual": list = list.filter((r) => r.gearbox === "MANUAL"); break;
    case "automatic": list = list.filter((r) => r.gearbox === "AUTOMATIC"); break;
  }
  const needle = q.trim().toLowerCase();
  if (needle) {
    const digits = needle.replace(/\D/g, "");
    list = list.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(needle) ||
        (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits)),
    );
  }
  return { list, counts };
}

/** Full student with everything the detail panel / page needs. Throws 404 when out of scope. */
export async function getStudentDetail(user: SessionUser, id: string) {
  const student = await db.student.findFirst({
    where: { id, ...studentScope(user) },
    include: {
      availability: true,
      unavailability: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } },
      skillProgress: { include: { skill: true } },
      exams: { orderBy: { scheduledAt: "desc" } },
      packages: { orderBy: { purchasedAt: "desc" }, include: { package: true, invoice: { include: { payments: true } } } },
      primaryInstructor: { select: { id: true, displayName: true } },
    },
  });
  if (!student) notFound();
  return student;
}

/** Paid/unpaid summary: instructors get the status only, admins get amounts too. */
export function paymentSummary(
  user: SessionUser,
  packages: { invoice: { totalCents: number; status: string; payments: { amountCents: number; status: string }[] } | null }[],
) {
  const invoices = packages.map((p) => p.invoice).filter((x): x is NonNullable<typeof x> => !!x && x.status !== "VOID");
  const total = invoices.reduce((a, i) => a + i.totalCents, 0);
  const paid = invoices.reduce((a, i) => a + i.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0), 0);
  const state: "PAID" | "PARTIAL" | "UNPAID" | "NONE" =
    invoices.length === 0 ? "NONE" : paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  return user.role === "ADMIN" ? { state, totalCents: total, paidCents: paid } : { state };
}
