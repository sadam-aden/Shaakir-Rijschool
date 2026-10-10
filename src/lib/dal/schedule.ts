import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/action-result";
import { windowsFor } from "@/lib/domain/availability";
import type { DayRef } from "@/lib/domain/best-fit";
import { checkSlot, type Conflict } from "@/lib/domain/check-slot";
import { reserveLines } from "@/lib/domain/ledger";
import { isoWeekday, zonedToUtc } from "@/lib/domain/time";
import { generateDay, isExamCandidate, priorityOf, type Candidate, type SchedulerResult, type SkipReason } from "@/lib/domain/scheduler";
import { addDays, keyParts, type DateKey } from "@/lib/date-key";
import { sendLessonNotification, scheduleReminder } from "@/lib/notifications/send";
import { getSchoolSettings } from "@/lib/queries/settings";
import { summarizeDraft } from "@/lib/ai/summary";
import { audit } from "./audit";
import { appendLedger } from "./ledger";
import { paidCentsOf } from "./invoices";
import { loadSlotContext } from "./slot-context";
import type { SessionUser } from "./session";

const HOUR = 3_600_000;
const asDbDate = (k: DateKey) => new Date(`${k}T00:00:00Z`);

function isExclusionViolation(e: unknown) {
  const s = `${(e as Error)?.message ?? ""} ${JSON.stringify((e as { cause?: unknown })?.cause ?? "")}`;
  return s.includes("23P01") || s.includes("lesson_no_instructor_overlap") || s.includes("lesson_no_vehicle_overlap");
}

/** Instructors may only plan for themselves; admins for anybody in the school. */
export async function resolveInstructor(user: SessionUser, requested?: string) {
  const id = user.role === "INSTRUCTOR" ? user.instructorId : (requested ?? user.instructorId);
  if (!id) return null;
  return db.instructor.findFirst({ where: { id, schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } });
}

// ───────────── inputs ─────────────

type StudentExtra = { address: string | null; lat: number | null; lng: number | null };

/** Everything the planner needs for one instructor and one day. */
export async function loadScheduleInputs(p: { schoolId: string; instructorId: string; dateKey: DateKey; locale: "nl" | "en" }) {
  const { schoolId, instructorId, dateKey, locale } = p;
  const { year, month, day } = keyParts(dateKey);
  const dayRef: DayRef = { year, month, day };
  const dayStart = zonedToUtc(year, month, day, 0, 0);
  const dayEnd = zonedToUtc(year, month, day, 23, 59);
  const now = new Date();
  const { settings } = await getSchoolSettings(schoolId);

  const ctx = await loadSlotContext({ schoolId, instructorId, from: new Date(dayStart.getTime() - 2 * HOUR), to: new Date(dayEnd.getTime() + 2 * HOUR), locale });

  const students = await db.student.findMany({
    where: { schoolId, status: "ACTIVE", track: { not: "THEORY_ONLY" }, OR: [{ primaryInstructorId: instructorId }, { primaryInstructorId: null }] },
    include: {
      availability: true,
      unavailability: { where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } },
      exams: { where: { kind: "PRACTICAL", status: { in: ["SCHEDULED", "REQUESTED"] } } },
    },
  });
  const ids = students.map((s) => s.id);

  const [lastLessons, sameDay, drafts, invoices] = await Promise.all([
    db.lesson.groupBy({ by: ["studentId"], where: { studentId: { in: ids }, status: "COMPLETED" }, _max: { startsAt: true } }),
    db.lesson.findMany({ where: { studentId: { in: ids }, status: { in: ["PLANNED", "DRAFT", "COMPLETED"] }, startsAt: { gte: dayStart, lte: dayEnd } }, select: { studentId: true } }),
    db.lesson.findMany({ where: { studentId: { in: ids }, status: "DRAFT", startsAt: { gte: now } }, select: { studentId: true, durationMin: true } }),
    db.invoice.findMany({
      where: { studentId: { in: ids }, status: { notIn: ["VOID", "DRAFT", "PAID"] } },
      select: { studentId: true, totalCents: true, payments: { select: { status: true, amountCents: true } } },
    }),
  ]);
  const last = new Map(lastLessons.map((l) => [l.studentId, l._max.startsAt]));
  const hasLesson = new Set(sameDay.map((l) => l.studentId));
  const draftMinutes = new Map<string, number>();
  for (const d of drafts) if (d.studentId) draftMinutes.set(d.studentId, (draftMinutes.get(d.studentId) ?? 0) + d.durationMin);
  const overdue = new Set(invoices.filter((i) => i.totalCents > paidCentsOf(i.payments)).map((i) => i.studentId));

  const extras = new Map<string, StudentExtra>();
  const candidates: Candidate[] = [];
  for (const s of students) {
    extras.set(s.id, { address: s.address, lat: s.lat, lng: s.lng });
    if (hasLesson.has(s.id)) continue; // "no lesson that day"
    const exam = s.exams.filter((e) => e.status === "SCHEDULED" && e.scheduledAt && e.scheduledAt >= now).sort((a, b) => +a.scheduledAt! - +b.scheduledAt!)[0];
    candidates.push({
      studentId: s.id, name: `${s.firstName} ${s.lastName}`, gearbox: s.gearbox,
      availability: s.availability.map((a) => ({ weekday: a.weekday, part: a.part, startMin: a.startMin, endMin: a.endMin })),
      unavailability: s.unavailability.map((u) => ({ startsAt: u.startsAt, endsAt: u.endsAt })),
      // hours already held by other (not yet approved) drafts cannot be promised twice
      minutesAvailable: s.minutesRemaining - s.minutesReserved - (draftMinutes.get(s.id) ?? 0),
      hasOverdueInvoice: !settings.allowBookingOnUnpaid && overdue.has(s.id),
      pickup: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
      lastLessonAt: last.get(s.id) ?? null, since: s.since,
      exam: exam ? { at: exam.scheduledAt!, readiness: exam.readiness, lessonsLeft: exam.lessonsLeftEstimate } : null,
      examRequested: s.exams.some((e) => e.status === "REQUESTED"),
    });
  }
  return { ctx, candidates, extras, dayRef, settings, now };
}

/** What the "Generate schedule" dialog and the dashboard banner show before anything is created. */
export async function previewSchedule(user: SessionUser, instructorId: string | undefined, dateKey: DateKey, locale: "nl" | "en") {
  const ins = await resolveInstructor(user, instructorId);
  if (!ins) return fail("notFound");
  const { ctx, candidates, dayRef, settings, now } = await loadScheduleInputs({ schoolId: user.schoolId, instructorId: ins.id, dateKey, locale });
  const weekday = isoWeekday(zonedToUtc(dayRef.year, dayRef.month, dayRef.day, 12, 0));
  const workMinutes = ctx.instructor.workingHours.filter((w) => w.weekday === weekday).reduce((a, w) => a + (w.endMin - w.startMin), 0);
  const busyMinutes = ctx.instructor.busy.reduce((a, b) => a + Math.round((+b.endsAt - +b.startsAt) / 60_000), 0);
  const cap = Math.min(ctx.instructor.maxMinutesPerDay, workMinutes);
  const eligible = candidates.filter((c) => c.minutesAvailable >= 30 && !c.hasOverdueInvoice && (c.availability.length === 0 || windowsFor(c.availability, weekday).length > 0));
  const examTop = candidates
    .filter((c) => isExamCandidate(c, now) && c.exam)
    .sort((a, b) => priorityOf(b, now, settings.scheduling.examFirst) - priorityOf(a, now, settings.scheduling.examFirst))[0];
  const existing = await db.scheduleDraft.findFirst({
    where: { schoolId: user.schoolId, instructorId: ins.id, date: asDbDate(dateKey), status: { in: ["PENDING_REVIEW", "PARTIALLY_APPROVED"] } },
    select: { id: true },
  });
  return ok({
    instructorId: ins.id, instructorName: ins.displayName, workingDay: workMinutes > 0,
    studentsAvailable: eligible.length,
    openPracticalSlots: Math.max(0, Math.floor((cap - busyMinutes) / 60)),
    theoryGroups: ctx.instructor.busy.filter((b) => b.kind === "THEORY").length,
    plannedMinutes: busyMinutes,
    plannedPractical: ctx.instructor.busy.filter((b) => b.kind !== "THEORY").length,
    examNote: examTop?.exam ? { name: examTop.name.split(" ")[0], at: examTop.exam.at.toISOString() } : null,
    pendingDraftId: existing?.id ?? null,
    rules: { maxMinutesPerDay: ctx.instructor.maxMinutesPerDay, maxTravelMinutes: settings.scheduling.maxTravelMinutes, examFirst: settings.scheduling.examFirst },
  });
}

// ───────────── generate ─────────────

export type GenerateOutcome = {
  dateKey: DateKey;
  draftId: string | null;
  lessons: number;
  minutes: number;
  skipped: { studentId: string; name: string; reason: SkipReason }[];
  explanation: string | null;
};

export async function generateDraft(
  user: SessionUser, input: { instructorId?: string; dateKey: DateKey; replace?: boolean }, locale: "nl" | "en",
) {
  const ins = await resolveInstructor(user, input.instructorId);
  if (!ins) return fail("notFound");
  const todayKey = new Date().toISOString().slice(0, 10);
  if (input.dateKey < addDays(todayKey, -1)) return fail("pastDate");

  const existing = await db.scheduleDraft.findMany({
    where: { schoolId: user.schoolId, instructorId: ins.id, date: asDbDate(input.dateKey), status: { in: ["PENDING_REVIEW", "PARTIALLY_APPROVED"] } },
    select: { id: true },
  });
  if (existing.length && !input.replace) return fail("draftExists");
  for (const d of existing) await discardDraft(user, d.id);

  const inputs = await loadScheduleInputs({ schoolId: user.schoolId, instructorId: ins.id, dateKey: input.dateKey, locale });
  const weekday = isoWeekday(zonedToUtc(inputs.dayRef.year, inputs.dayRef.month, inputs.dayRef.day, 12, 0));
  if (!inputs.ctx.instructor.workingHours.some((w) => w.weekday === weekday)) return fail("noWorkingHours");

  const result: SchedulerResult = generateDay(inputs.ctx, inputs.candidates, inputs.dayRef, inputs.now, inputs.settings.scheduling);
  if (result.placements.length === 0) {
    return ok<GenerateOutcome>({ dateKey: input.dateKey, draftId: null, lessons: 0, minutes: 0, skipped: result.skipped, explanation: null });
  }

  const explanation = await summarizeDraft(result, inputs.candidates, inputs.now, locale, ins.displayName);
  const draftId = await db.$transaction(async (tx) => {
    const draft = await tx.scheduleDraft.create({
      data: {
        schoolId: user.schoolId, date: asDbDate(input.dateKey), instructorId: ins.id, explanation: explanation.text,
        stats: { ...result.stats, skipped: result.skipped, examCandidates: result.placements.filter((p) => p.examCandidate).length, aiSummary: explanation.byAi } as unknown as Prisma.InputJsonValue,
      },
    });
    for (const p of result.placements) {
      const ex = inputs.extras.get(p.studentId)!;
      const lesson = await tx.lesson.create({
        data: {
          schoolId: user.schoolId, type: "PRACTICAL", instructorId: ins.id, studentId: p.studentId, vehicleId: p.vehicleId, startsAt: p.startsAt, endsAt: p.endsAt,
          durationMin: p.durationMin, gearbox: p.gearbox, status: "DRAFT", source: "AI", scheduleDraftId: draft.id,
          pickupAddress: ex.address, pickupLat: ex.lat, pickupLng: ex.lng,
        },
      });
      await tx.scheduleDraftItem.create({ data: { schoolId: user.schoolId, scheduleDraftId: draft.id, lessonId: lesson.id, originalStartsAt: p.startsAt, originalEndsAt: p.endsAt } });
    }
    await audit(tx, user, "schedule.generate", "ScheduleDraft", draft.id, { date: input.dateKey, lessons: result.placements.length });
    return draft.id;
  });
  return ok<GenerateOutcome>({
    dateKey: input.dateKey, draftId, lessons: result.stats.lessons, minutes: result.stats.minutes, skipped: result.skipped, explanation: explanation.text,
  });
}

// ───────────── review: approve, discard, remove ─────────────

async function findDraft(user: SessionUser, draftId: string) {
  return db.scheduleDraft.findFirst({
    where: { id: draftId, schoolId: user.schoolId, ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? "__none__" } : {}) },
    include: { lessons: { where: { status: "DRAFT" }, orderBy: { startsAt: "asc" } } },
  });
}

export type ApprovalResult = { approved: number; failed: { lessonId: string; studentName: string; conflicts: Conflict[] }[] };

/**
 * Approve & notify. Every lesson is re-validated with the same checkSlot as manual booking (the day may have changed
 * since the draft was made), then set to PLANNED with its hours reserved, in its own transaction. Lessons that no longer
 * fit stay in the draft (partial approval). Students are informed in their own language; 24 h reminders are queued.
 */
export async function approveDraft(
  user: SessionUser, draftId: string, notify: { sms: boolean; email: boolean; reminder: boolean }, locale: "nl" | "en",
) {
  const draft = await findDraft(user, draftId);
  if (!draft) return fail("notFound");
  if (draft.status === "APPROVED" || draft.status === "DISCARDED") return fail("invalidState");

  const approvedIds: string[] = [];
  const failed: ApprovalResult["failed"] = [];
  for (const lesson of draft.lessons) {
    if (!lesson.studentId) continue;
    const student = await db.student.findUnique({ where: { id: lesson.studentId }, select: { firstName: true, lastName: true, gearbox: true } });
    const name = student ? `${student.firstName} ${student.lastName}` : "";
    const ctx = await loadSlotContext({
      schoolId: user.schoolId, instructorId: lesson.instructorId, studentId: lesson.studentId,
      from: new Date(lesson.startsAt.getTime() - 12 * HOUR), to: new Date(lesson.endsAt.getTime() + 12 * HOUR), locale,
    });
    const check = checkSlot(ctx, {
      startsAt: lesson.startsAt, endsAt: lesson.endsAt, type: "PRACTICAL", gearbox: lesson.gearbox, excludeLessonId: lesson.id, preferredVehicleId: lesson.vehicleId,
      pickup: lesson.pickupLat != null && lesson.pickupLng != null ? { lat: lesson.pickupLat, lng: lesson.pickupLng } : null,
    });
    if (!check.ok) {
      failed.push({ lessonId: lesson.id, studentName: name, conflicts: check.conflicts });
      continue;
    }
    try {
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${lesson.studentId} FOR UPDATE`;
        const fresh = await tx.student.findUniqueOrThrow({ where: { id: lesson.studentId! } });
        if (fresh.minutesRemaining - fresh.minutesReserved < lesson.durationMin) throw new Error("NOT_ENOUGH_HOURS");
        await tx.lesson.update({ where: { id: lesson.id }, data: { status: "PLANNED", vehicleId: check.vehicleId } });
        await appendLedger(tx, { schoolId: user.schoolId, studentId: lesson.studentId!, lessonId: lesson.id, createdById: user.id, note: "ai-draft" }, reserveLines(lesson.durationMin));
      });
      approvedIds.push(lesson.id);
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_ENOUGH_HOURS") failed.push({ lessonId: lesson.id, studentName: name, conflicts: [{ key: "notEnoughHours" }] });
      else if (isExclusionViolation(e)) failed.push({ lessonId: lesson.id, studentName: name, conflicts: [{ key: "instructorBusy" }] });
      else throw e;
    }
  }

  const channels = { sms: notify.sms, email: notify.email };
  for (const id of approvedIds) {
    if (channels.sms || channels.email) await sendLessonNotification(id, "confirmation", channels);
    if (notify.reminder) await scheduleReminder(id, channels);
  }

  const total = await db.scheduleDraftItem.count({ where: { scheduleDraftId: draftId } });
  const everApproved = await db.lesson.count({ where: { scheduleDraftId: draftId, status: { in: ["PLANNED", "COMPLETED"] } } });
  const stillDraft = failed.length;
  const stats = (draft.stats ?? {}) as Record<string, unknown>;
  await db.scheduleDraft.update({
    where: { id: draftId },
    data: {
      status: stillDraft > 0 ? "PARTIALLY_APPROVED" : "APPROVED", reviewedAt: new Date(),
      stats: { ...stats, approved: everApproved, failedAtApproval: stillDraft, items: total } as unknown as Prisma.InputJsonValue,
    },
  });
  await audit(db, user, "schedule.approve", "ScheduleDraft", draftId, { approved: approvedIds.length, failed: failed.length });
  return ok<ApprovalResult>({ approved: approvedIds.length, failed });
}

/** Removes the draft lessons that are still unapproved; the draft and its stats stay for the reports. */
export async function discardDraft(user: SessionUser, draftId: string) {
  const draft = await findDraft(user, draftId);
  if (!draft) return fail("notFound");
  if (draft.status === "APPROVED" || draft.status === "DISCARDED") return fail("invalidState");
  const ids = draft.lessons.map((l) => l.id);
  const approved = await db.lesson.count({ where: { scheduleDraftId: draftId, status: { in: ["PLANNED", "COMPLETED"] } } });
  await db.$transaction(async (tx) => {
    await tx.scheduleDraftItem.updateMany({ where: { scheduleDraftId: draftId, lessonId: { in: ids } }, data: { outcome: "REMOVED" } });
    await tx.lesson.deleteMany({ where: { id: { in: ids }, status: "DRAFT" } }); // drafts reserve no hours, so there is no ledger to undo
    await tx.scheduleDraft.update({ where: { id: draftId }, data: { status: approved > 0 ? "PARTIALLY_APPROVED" : "DISCARDED", reviewedAt: new Date() } });
    await audit(tx, user, "schedule.discard", "ScheduleDraft", draftId, { removed: ids.length });
  });
  return ok({ removed: ids.length });
}

/** Remove one lesson from a draft during review (marked REMOVED in the draft's items). */
export async function removeDraftLesson(user: SessionUser, lessonId: string) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, schoolId: user.schoolId, status: "DRAFT", scheduleDraftId: { not: null }, ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? "__none__" } : {}) },
  });
  if (!lesson?.scheduleDraftId) return fail("notFound");
  const draftId = lesson.scheduleDraftId;
  await db.$transaction(async (tx) => {
    await tx.scheduleDraftItem.updateMany({ where: { lessonId }, data: { outcome: "REMOVED" } });
    await tx.lesson.delete({ where: { id: lessonId } });
    const left = await tx.lesson.count({ where: { scheduleDraftId: draftId, status: "DRAFT" } });
    const approved = await tx.lesson.count({ where: { scheduleDraftId: draftId, status: { in: ["PLANNED", "COMPLETED"] } } });
    if (left === 0) await tx.scheduleDraft.update({ where: { id: draftId }, data: { status: approved > 0 ? "APPROVED" : "DISCARDED", reviewedAt: new Date() } });
  });
  return ok();
}

/** Drafts still waiting for review in the visible calendar range (for the banner above the grid). */
export async function pendingDrafts(user: SessionUser, from: DateKey, to: DateKey, instructorId?: string) {
  const drafts = await db.scheduleDraft.findMany({
    where: {
      schoolId: user.schoolId, date: { gte: asDbDate(from), lte: asDbDate(to) }, status: { in: ["PENDING_REVIEW", "PARTIALLY_APPROVED"] },
      ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? "__none__" } : instructorId ? { instructorId } : {}),
    },
    include: { instructor: { select: { displayName: true } }, lessons: { where: { status: "DRAFT" }, select: { durationMin: true } } },
    orderBy: { date: "asc" },
  });
  return drafts
    .filter((d) => d.lessons.length > 0)
    .map((d) => ({
      id: d.id, dateKey: d.date.toISOString().slice(0, 10), instructorName: d.instructor.displayName, lessons: d.lessons.length,
      minutes: d.lessons.reduce((a, l) => a + l.durationMin, 0), explanation: d.explanation,
      partial: d.status === "PARTIALLY_APPROVED",
    }));
}

export type { SchedulerResult };
