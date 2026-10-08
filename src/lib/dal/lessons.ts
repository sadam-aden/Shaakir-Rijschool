import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";
import { fail, ok } from "@/lib/action-result";
import { checkSlot, type Conflict } from "@/lib/domain/check-slot";
import { canBook, consumeLines, isChargeableCancellation, releaseLines, reserveLines, resizeLines } from "@/lib/domain/ledger";
import { estimateReadiness } from "@/lib/domain/student-status";
import { getSchoolSettings } from "@/lib/queries/settings";
import { dropQueuedReminders, scheduleReminder, sendLessonNotification } from "@/lib/notifications/send";
import type { BookLessonInput, CancelLessonInput, CompleteLessonInput, MoveLessonInput } from "@/lib/schemas/lesson";
import { bookLessonSchema, cancelLessonSchema, completeLessonSchema, moveLessonSchema } from "@/lib/schemas/lesson";
import { audit } from "./audit";
import { findLessonFor, findStudentFor } from "./guards";
import { appendLedger } from "./ledger";
import { lessonScope } from "./scope";
import type { SessionUser } from "./session";
import { loadSlotContext } from "./slot-context";

const HOUR = 3_600_000;

export type ConflictFail = ActionResult<never> & { conflicts?: Conflict[] };

/** DB exclusion constraints are the final guard against double booking; map them to a friendly result. */
function isExclusionViolation(e: unknown) {
  const s = `${(e as Error)?.message ?? ""} ${JSON.stringify((e as { cause?: unknown })?.cause ?? "")}`;
  return s.includes("23P01") || s.includes("lesson_no_instructor_overlap") || s.includes("lesson_no_vehicle_overlap");
}

function conflictResult(conflicts: Conflict[]) {
  return { ok: false as const, error: "conflict", conflicts };
}

type Locale = "nl" | "en";

/** Resolves who the lesson is for. Instructors can only plan for themselves; admins for anyone in the school. */
function resolveInstructorId(user: SessionUser, requested: string | undefined) {
  if (user.role === "INSTRUCTOR") return user.instructorId;
  return requested ?? user.instructorId;
}

export type BookResult = { lessonIds: string[]; skipped: { startsAt: string; conflicts: Conflict[] }[] };

export async function bookLesson(
  user: SessionUser, rawInput: BookLessonInput, locale: Locale,
): Promise<ActionResult<BookResult> | ReturnType<typeof conflictResult>> {
  const p = bookLessonSchema.safeParse(rawInput);
  if (!p.success) return fail("invalid");
  const input = p.data;
  const instructorId = resolveInstructorId(user, input.instructorId);
  if (!instructorId) return fail("forbidden");
  const student = await findStudentFor(user, input.studentId);
  if (!student) return fail("notFound");
  const instructor = await db.instructor.findFirst({ where: { id: instructorId, schoolId: user.schoolId, active: true } });
  if (!instructor) return fail("notFound");

  const override = user.role === "ADMIN" ? input.override : undefined;
  if ((override?.availability || override?.hours) && !override.reason?.trim()) return fail("overrideReason");

  const { settings } = await getSchoolSettings(user.schoolId);
  const first = new Date(input.startsAt);
  const lessonIds: string[] = [];
  const skipped: BookResult["skipped"] = [];

  const rule = input.occurrences > 1
    ? await db.recurrenceRule.create({ data: { schoolId: user.schoolId, frequency: "WEEKLY", count: input.occurrences } })
    : null;

  for (let k = 0; k < input.occurrences; k++) {
    const startsAt = new Date(first.getTime() + k * 7 * 24 * HOUR);
    const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);
    const ctx = await loadSlotContext({
      schoolId: user.schoolId, instructorId, studentId: student.id,
      from: new Date(startsAt.getTime() - 12 * HOUR), to: new Date(endsAt.getTime() + 12 * HOUR), locale,
    });
    const check = checkSlot(ctx, {
      startsAt, endsAt, type: input.type, gearbox: student.gearbox, preferredVehicleId: input.vehicleId,
      pickup: student.lat != null && student.lng != null ? { lat: student.lat, lng: student.lng } : null,
      overrides: override ? { availability: override.availability, hours: override.hours } : undefined,
    });
    if (!check.ok) {
      if (k === 0) return conflictResult(check.conflicts);
      skipped.push({ startsAt: startsAt.toISOString(), conflicts: check.conflicts });
      continue;
    }

    try {
      const lesson = await db.$transaction(async (tx) => {
        // lock the student row so concurrent bookings cannot both spend the same hours
        await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${student.id} FOR UPDATE`;
        const fresh = await tx.student.findUniqueOrThrow({ where: { id: student.id } });
        if (input.type === "PRACTICAL" && !override?.hours) {
          const b = canBook(fresh.minutesRemaining - fresh.minutesReserved, input.durationMin);
          if (!b.ok) throw new Error("NOT_ENOUGH_HOURS");
        }
        const created = await tx.lesson.create({
          data: {
            schoolId: user.schoolId, type: input.type, instructorId, studentId: student.id, vehicleId: check.vehicleId,
            startsAt, endsAt, durationMin: input.durationMin, gearbox: student.gearbox, status: "PLANNED",
            source: rule ? "RECURRING" : "MANUAL", recurrenceRuleId: rule?.id,
            pickupAddress: input.pickupAddress ?? student.address, pickupLat: student.lat, pickupLng: student.lng,
          },
        });
        if (input.type === "PRACTICAL") {
          await appendLedger(tx, { schoolId: user.schoolId, studentId: student.id, lessonId: created.id, createdById: user.id }, reserveLines(input.durationMin));
        } else {
          // CBR exam: uses the exam credit of the package when there is one (otherwise invoiced in Phase 2)
          const pkg = await tx.studentPackage.findFirst({ where: { studentId: student.id, status: "ACTIVE", examCredits: { gt: 0 } } });
          if (pkg) await tx.studentPackage.update({ where: { id: pkg.id }, data: { examCredits: { decrement: 1 } } });
          const attempts = await tx.exam.count({ where: { studentId: student.id, kind: "PRACTICAL", status: { in: ["PASSED", "FAILED"] } } });
          await tx.exam.create({
            data: { schoolId: user.schoolId, studentId: student.id, kind: "PRACTICAL", scheduledAt: startsAt, cbrLocation: "CBR Rotterdam", lessonId: created.id, status: "SCHEDULED", attemptNumber: attempts + 1 },
          });
        }
        if (override?.availability || override?.hours) {
          await audit(tx, user, "booking.override", "Lesson", created.id, {
            availability: !!override.availability, hours: !!override.hours, reason: override.reason ?? "",
            conflicts: check.overridden.map((c) => c.key),
          });
        }
        return created;
      });
      lessonIds.push(lesson.id);
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_ENOUGH_HOURS") {
        if (k === 0) return fail("notEnoughHours");
        skipped.push({ startsAt: startsAt.toISOString(), conflicts: [{ key: "notEnoughHours" }] });
        continue;
      }
      if (isExclusionViolation(e)) {
        if (k === 0) return fail("conflict");
        skipped.push({ startsAt: startsAt.toISOString(), conflicts: [{ key: "instructorBusy" }] });
        continue;
      }
      throw e;
    }
  }

  // notifications after the transaction(s) so a mail problem never blocks a booking
  const channels = { sms: input.notify.sms, email: input.notify.email };
  if (lessonIds.length && (channels.sms || channels.email)) await sendLessonNotification(lessonIds[0], "confirmation", channels);
  if (input.notify.reminder) for (const id of lessonIds) await scheduleReminder(id, channels);
  void settings;
  return ok({ lessonIds, skipped });
}

export async function moveLesson(user: SessionUser, rawInput: MoveLessonInput, locale: Locale) {
  const p = moveLessonSchema.safeParse(rawInput);
  if (!p.success) return fail("invalid");
  const input = p.data;
  const lesson = await findLessonFor(user, input.lessonId);
  if (!lesson) return fail("notFound");
  if (lesson.status !== "PLANNED" && lesson.status !== "DRAFT") return fail("invalidState");

  const instructorId = user.role === "ADMIN" ? (input.instructorId ?? lesson.instructorId) : lesson.instructorId;
  const durationMin = input.durationMin ?? lesson.durationMin;
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const override = user.role === "ADMIN" ? input.override : undefined;
  if ((override?.availability || override?.hours) && !override.reason?.trim()) return fail("overrideReason");

  const student = lesson.studentId ? await findStudentFor(user, lesson.studentId) : null;
  const ctx = await loadSlotContext({
    schoolId: user.schoolId, instructorId, studentId: student?.id,
    from: new Date(startsAt.getTime() - 12 * HOUR), to: new Date(endsAt.getTime() + 12 * HOUR), locale,
  });
  // hours held by this lesson itself must not count against it
  if (ctx.student && lesson.status === "PLANNED" && lesson.type === "PRACTICAL") ctx.student.minutesAvailable += lesson.durationMin;

  const check = checkSlot(ctx, {
    startsAt, endsAt, type: lesson.type, gearbox: lesson.gearbox ?? student?.gearbox ?? null, excludeLessonId: lesson.id,
    preferredVehicleId: input.vehicleId ?? lesson.vehicleId,
    pickup: lesson.pickupLat != null && lesson.pickupLng != null ? { lat: lesson.pickupLat, lng: lesson.pickupLng } : null,
    overrides: override ? { availability: override.availability, hours: override.hours } : undefined,
  });
  if (!check.ok) return conflictResult(check.conflicts);

  try {
    await db.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { startsAt, endsAt, durationMin, instructorId, vehicleId: check.vehicleId, pickupAddress: input.pickupAddress ?? lesson.pickupAddress },
      });
      if (lesson.studentId && lesson.status === "PLANNED" && lesson.type === "PRACTICAL" && durationMin !== lesson.durationMin) {
        await appendLedger(tx, { schoolId: user.schoolId, studentId: lesson.studentId, lessonId: lesson.id, createdById: user.id, note: "resize" }, resizeLines(lesson.durationMin, durationMin));
      }
      if (override?.availability || override?.hours) {
        await audit(tx, user, "move.override", "Lesson", lesson.id, { reason: override.reason ?? "", conflicts: check.overridden.map((c) => c.key) });
      }
    });
  } catch (e) {
    if (isExclusionViolation(e)) return fail("conflict");
    throw e;
  }

  await dropQueuedReminders(lesson.id);
  if (lesson.status === "PLANNED") {
    if (lesson.studentId) await scheduleReminder(lesson.id, { sms: true, email: true });
    if (input.notify) await sendLessonNotification(lesson.id, "change", { sms: true, email: true });
  }
  return ok();
}

async function updateSkills(tx: Prisma.TransactionClient, schoolId: string, studentId: string, lessonId: string, skills: { skillId: string; value: number }[]) {
  for (const s of skills) {
    await tx.skillAssessment.create({ data: { schoolId, studentId, skillId: s.skillId, lessonId, value: s.value } });
    await tx.skillProgress.upsert({
      where: { studentId_skillId: { studentId, skillId: s.skillId } },
      create: { schoolId, studentId, skillId: s.skillId, value: s.value },
      update: { value: s.value },
    });
  }
}

/** Refreshes readiness on the student's next scheduled practical exam from current skills. */
async function refreshReadiness(tx: Prisma.TransactionClient, studentId: string) {
  const [progress, completed, exam] = await Promise.all([
    tx.skillProgress.findMany({ where: { studentId, skill: { isCore: true } }, select: { value: true } }),
    tx.lesson.count({ where: { studentId, type: "PRACTICAL", status: "COMPLETED" } }),
    tx.exam.findFirst({ where: { studentId, kind: "PRACTICAL", status: { in: ["SCHEDULED", "REQUESTED"] } }, orderBy: { scheduledAt: "asc" } }),
  ]);
  if (!exam || progress.length === 0) return;
  const r = estimateReadiness(progress.map((x) => x.value), completed);
  await tx.exam.update({ where: { id: exam.id }, data: { readiness: r.readiness, lessonsLeftEstimate: r.lessonsLeft } });
}

export async function completeLesson(user: SessionUser, rawInput: CompleteLessonInput) {
  const p = completeLessonSchema.safeParse(rawInput);
  if (!p.success) return fail("invalid");
  const input = p.data;
  const lesson = await findLessonFor(user, input.lessonId);
  if (!lesson) return fail("notFound");
  if (lesson.status !== "PLANNED") return fail("invalidState");

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lesson.id },
      data: {
        status: "COMPLETED", completedAt: new Date(),
        instructorNotes: input.instructorNotes ?? lesson.instructorNotes, studentNotes: input.studentNotes ?? lesson.studentNotes,
      },
    });
    if (lesson.studentId && lesson.type === "PRACTICAL") {
      await appendLedger(tx, { schoolId: user.schoolId, studentId: lesson.studentId, lessonId: lesson.id, createdById: user.id }, consumeLines(lesson.durationMin));
      if (input.skills.length) {
        await updateSkills(tx, user.schoolId, lesson.studentId, lesson.id, input.skills);
        await refreshReadiness(tx, lesson.studentId);
      }
    }
    if (lesson.type === "THEORY" && lesson.theoryGroupId) {
      // everybody still "enrolled" counts as attended unless marked otherwise
      await tx.theoryEnrollment.updateMany({ where: { theoryGroupId: lesson.theoryGroupId, attendance: "ENROLLED" }, data: { attendance: "ATTENDED" } });
    }
  });
  await dropQueuedReminders(lesson.id);
  return ok();
}

export async function markNoShow(user: SessionUser, lessonId: string, chargeable?: boolean) {
  const lesson = await findLessonFor(user, lessonId);
  if (!lesson) return fail("notFound");
  if (lesson.status !== "PLANNED") return fail("invalidState");
  const charge = chargeable ?? true; // default policy: no-shows consume the hours (configurable per case)
  await db.$transaction(async (tx) => {
    await tx.lesson.update({ where: { id: lesson.id }, data: { status: "NO_SHOW", chargeable: charge } });
    if (lesson.studentId && lesson.type === "PRACTICAL") {
      await appendLedger(tx, { schoolId: user.schoolId, studentId: lesson.studentId, lessonId: lesson.id, createdById: user.id, note: "no-show" }, charge ? consumeLines(lesson.durationMin) : releaseLines(lesson.durationMin));
    }
  });
  await dropQueuedReminders(lesson.id);
  return ok();
}

export async function cancelLesson(user: SessionUser, rawInput: CancelLessonInput) {
  const p = cancelLessonSchema.safeParse(rawInput);
  if (!p.success) return fail("invalid");
  const input = p.data;
  const lesson = await findLessonFor(user, input.lessonId);
  if (!lesson) return fail("notFound");
  if (lesson.status !== "PLANNED" && lesson.status !== "DRAFT") return fail("invalidState");
  const { settings } = await getSchoolSettings(user.schoolId);

  // school cancellations are never charged; student cancellations inside the window are (admin may override)
  const defaultCharge = input.by === "STUDENT" && isChargeableCancellation(lesson.startsAt, new Date(), settings.cancellationWindowHours);
  const charge = input.by === "SCHOOL" ? false : (input.chargeable ?? defaultCharge);

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lesson.id },
      data: { status: input.by === "STUDENT" ? "CANCELLED_STUDENT" : "CANCELLED_SCHOOL", cancellationReason: input.reason, chargeable: charge },
    });
    if (lesson.studentId && lesson.type === "PRACTICAL" && lesson.status === "PLANNED") {
      await appendLedger(tx, { schoolId: user.schoolId, studentId: lesson.studentId, lessonId: lesson.id, createdById: user.id, note: "cancellation" }, charge ? consumeLines(lesson.durationMin) : releaseLines(lesson.durationMin));
    }
    await tx.exam.updateMany({ where: { lessonId: lesson.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
  });
  await dropQueuedReminders(lesson.id);
  if (input.notify && lesson.status === "PLANNED") await sendLessonNotification(lesson.id, "cancellation", { sms: true, email: true });
  return ok({ chargeable: charge });
}

/** All PLANNED practical lessons in the past (the "needs check-off" list) visible to this user. */
export async function lessonsNeedingCheckOff(user: SessionUser) {
  return db.lesson.findMany({
    where: { ...lessonScope(user), status: "PLANNED", endsAt: { lt: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { student: { select: { firstName: true, lastName: true } }, theoryGroup: { select: { titleNl: true, titleEn: true } } },
  });
}
