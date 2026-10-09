import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { lessonScope } from "@/lib/dal/scope";
import type { Avail } from "@/lib/domain/availability";
import { localDateKey, localParts, zonedToUtc } from "@/lib/domain/time";
import { addDays, keyParts, mondayOfKey, type DateKey } from "@/lib/date-key";
import { pendingDrafts } from "@/lib/dal/schedule";
import { getSchoolSettings } from "./settings";
import { getStudentRows } from "./students";

export const GRID_START = 8 * 60;
export const GRID_END = 20 * 60;

export type CalItem = {
  id: string;
  dayKey: DateKey;
  startMin: number;
  endMin: number;
  startsAt: string;
  type: "PRACTICAL" | "THEORY" | "EXAM";
  status: "DRAFT" | "PLANNED" | "COMPLETED" | "NO_SHOW";
  title: string;
  subtitle: string | null;
  gearbox: "MANUAL" | "AUTOMATIC" | null;
  instructorId: string;
  instructorName: string;
  canMove: boolean;
  studentId: string | null;
  availability: Avail[];
  durationMin: number;
};

export type OffBlock = { dayKey: DateKey; fromMin: number; toMin: number; label: "free" | "timeOff" };

export type ToScheduleCard = {
  id: string;
  name: string;
  gearbox: "MANUAL" | "AUTOMATIC";
  minutesAvailable: number;
  minutesPurchased: number;
  availability: Avail[];
  defaultDuration: number;
  kind: "practical" | "theory";
  theory?: { done: number; total: number };
};

export type CalendarData = {
  days: DateKey[];
  items: CalItem[];
  offBlocks: OffBlock[];
  toSchedule: ToScheduleCard[];
  instructors: { id: string; displayName: string }[];
  instructorId: string | "all";
  dayTotals: Record<string, number>;
  /** minutes per day that are still only a draft */
  draftTotals: Record<string, number>;
  drafts: Awaited<ReturnType<typeof pendingDrafts>>;
  rules: { maxHours: number; maxTravelMinutes: number; examFirst: boolean };
};

export async function getCalendarData(
  user: SessionUser, p: { view: "day" | "week"; dateKey: DateKey; instructor?: string; locale: "nl" | "en" },
): Promise<CalendarData> {
  const days = p.view === "day" ? [p.dateKey] : Array.from({ length: 6 }, (_, i) => addDays(mondayOfKey(p.dateKey), i));
  const first = keyParts(days[0]);
  const last = keyParts(days[days.length - 1]);
  const from = zonedToUtc(first.year, first.month, first.day, 0, 0);
  const to = new Date(zonedToUtc(last.year, last.month, last.day, 0, 0).getTime() + 26 * 3_600_000);

  const instructors = await db.instructor.findMany({
    where: { schoolId: user.schoolId, active: true, ...(user.role === "INSTRUCTOR" ? { id: user.instructorId ?? "__none__" } : {}) },
    select: { id: true, displayName: true, workingHours: true, timeOff: { where: { startsAt: { lt: to }, endsAt: { gt: from } } } },
    orderBy: { displayName: "asc" },
  });
  const selected: string | "all" =
    user.role === "INSTRUCTOR" ? (user.instructorId ?? "all") : p.instructor === "all" ? "all" : (p.instructor && instructors.some((i) => i.id === p.instructor) ? p.instructor : (user.instructorId ?? "all"));

  const lessons = await db.lesson.findMany({
    where: {
      ...lessonScope(user),
      ...(selected !== "all" ? { instructorId: selected } : {}),
      status: { in: ["DRAFT", "PLANNED", "COMPLETED", "NO_SHOW"] },
      startsAt: { gte: from, lt: to },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, area: true, availability: true } },
      instructor: { select: { displayName: true } },
      theoryGroup: { select: { titleNl: true, titleEn: true, _count: { select: { enrollments: true } }, capacity: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const now = new Date();
  const items: CalItem[] = lessons.map((l) => {
    const s = localParts(l.startsAt);
    const dayKey = localDateKey(l.startsAt);
    const theory = l.theoryGroup;
    return {
      id: l.id, dayKey, startMin: s.minutes, endMin: s.minutes + l.durationMin, startsAt: l.startsAt.toISOString(),
      type: l.type, status: l.status as CalItem["status"],
      title: theory ? (p.locale === "nl" ? theory.titleNl : theory.titleEn) : l.student ? `${l.student.firstName} ${l.student.lastName}` : "—",
      subtitle: theory ? String(theory._count.enrollments) : (l.instructorNotes || l.student?.area || null),
      gearbox: l.gearbox, instructorId: l.instructorId, instructorName: l.instructor.displayName,
      canMove: (l.status === "PLANNED" || l.status === "DRAFT") && l.type !== "THEORY" && l.endsAt > now,
      studentId: l.studentId, durationMin: l.durationMin,
      availability: (l.student?.availability ?? []).map((a) => ({ weekday: a.weekday, part: a.part, startMin: a.startMin, endMin: a.endMin })),
    };
  });

  // blocked time for a single instructor: outside working hours and time off
  const offBlocks: OffBlock[] = [];
  const ins = selected !== "all" ? instructors.find((i) => i.id === selected) : undefined;
  if (ins) {
    for (const dayKey of days) {
      const weekday = ((new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
      const wins = ins.workingHours.filter((w) => w.weekday === weekday).map((w) => [Math.max(w.startMin, GRID_START), Math.min(w.endMin, GRID_END)] as const).sort((a, b) => a[0] - b[0]);
      let cursor = GRID_START;
      for (const [a, b] of wins) {
        if (a > cursor) offBlocks.push({ dayKey, fromMin: cursor, toMin: a, label: "free" });
        cursor = Math.max(cursor, b);
      }
      if (cursor < GRID_END) offBlocks.push({ dayKey, fromMin: cursor, toMin: GRID_END, label: "free" });
      const { year, month, day } = keyParts(dayKey);
      const ds = zonedToUtc(year, month, day, 0, 0);
      const de = zonedToUtc(year, month, day, 23, 59);
      for (const t of ins.timeOff) {
        if (t.endsAt <= ds || t.startsAt >= de) continue;
        const a = t.startsAt > ds ? localParts(t.startsAt).minutes : 0;
        const b = t.endsAt < de ? localParts(t.endsAt).minutes : 24 * 60;
        offBlocks.push({ dayKey, fromMin: Math.max(a, GRID_START), toMin: Math.min(b, GRID_END), label: "timeOff" });
      }
    }
  }

  const dayTotals: Record<string, number> = {};
  const draftTotals: Record<string, number> = {};
  for (const i of items) {
    const bucket = i.status === "DRAFT" ? draftTotals : dayTotals;
    bucket[i.dayKey] = (bucket[i.dayKey] ?? 0) + i.durationMin;
  }
  const { settings } = await getSchoolSettings(user.schoolId);
  const drafts = await pendingDrafts(user, days[0], days[days.length - 1], selected !== "all" ? selected : undefined);

  // students still to schedule: practical students with hours left and no lesson in the shown range
  const { rows } = await getStudentRows(user);
  const planned = new Set(items.map((i) => i.studentId).filter(Boolean));
  const toSchedule: ToScheduleCard[] = rows
    .filter((r) => r.status === "ACTIVE" && !planned.has(r.id))
    .flatMap((r): ToScheduleCard[] => {
      if (r.track === "THEORY_ONLY") {
        return r.theoryAttended < r.theoryTotal
          ? [{ id: r.id, name: `${r.firstName} ${r.lastName}`, gearbox: r.gearbox, minutesAvailable: 0, minutesPurchased: 0, availability: r.availability, defaultDuration: 0, kind: "theory", theory: { done: r.theoryAttended, total: r.theoryTotal } }]
          : [];
      }
      if (r.minutesAvailable < 30) return [];
      return [{
        id: r.id, name: `${r.firstName} ${r.lastName}`, gearbox: r.gearbox, minutesAvailable: r.minutesAvailable, minutesPurchased: r.minutesPurchased,
        availability: r.availability, defaultDuration: r.minutesAvailable >= 90 && r.examSoon ? 90 : r.minutesAvailable >= 60 ? 60 : 30, kind: "practical",
      }];
    })
    .sort((a, b) => (a.kind === "theory" ? 1 : 0) - (b.kind === "theory" ? 1 : 0) || a.minutesAvailable - b.minutesAvailable)
    .slice(0, 8);

  return { days, items, offBlocks, toSchedule, instructors: instructors.map((i) => ({ id: i.id, displayName: i.displayName })), instructorId: selected, dayTotals, draftTotals, drafts,
    rules: { maxHours: settings.maxTeachingMinutesPerDay / 60, maxTravelMinutes: settings.scheduling.maxTravelMinutes, examFirst: settings.scheduling.examFirst } };
}
