"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { audit } from "@/lib/dal/audit";
import { sellPackage } from "@/lib/dal/invoices";
import { findStudentFor } from "@/lib/dal/guards";
import { requireAdmin, requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { refreshStudentCache } from "@/lib/dal/ledger";
import { coordsFor } from "@/lib/places";
import { studentSchema, type StudentInput } from "@/lib/schemas/student";

const COLORS = ["#DBEAFE", "#E0E7FF", "#DCFCE7", "#FEE2E2", "#FEF3C7", "#F3E8FF"];

/** Creates a student; an admin can pick a package at the same time (creates the invoice and the hours). */
export async function createStudentAction(input: StudentInput, packageId?: string) {
  const user = await requireUser();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;
  const count = await db.student.count({ where: { schoolId: user.schoolId } });
  const coords = await coordsFor(d.province, d.city, d.area);
  const s = await db.student.create({
    data: {
      ...d,
      lat: d.lat ?? coords?.lat, lng: d.lng ?? coords?.lng,
      schoolId: user.schoolId,
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      // instructors can only add students for themselves
      primaryInstructorId: user.role === "ADMIN" ? (d.primaryInstructorId ?? user.instructorId) : user.instructorId,
      avatarColor: COLORS[count % COLORS.length],
    },
  });
  let invoiceNumber: string | null = null;
  if (packageId && user.role === "ADMIN") {
    const sold = await sellPackage(user, s.id, packageId);
    if (sold.ok) invoiceNumber = sold.data.number;
  }
  revalidatePath("/leerlingen");
  revalidatePath("/betalingen");
  return ok({ id: s.id, invoiceNumber });
}

export async function updateStudentAction(id: string, input: StudentInput) {
  const user = await requireUser();
  if (!(await findStudentFor(user, id))) return fail("notFound");
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;
  const coords = await coordsFor(d.province, d.city, d.area);
  await db.student.update({
    where: { id },
    data: {
      ...d,
      ...(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : coords ? { lat: coords.lat, lng: coords.lng } : {}),
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      // only admins may reassign students
      primaryInstructorId: user.role === "ADMIN" ? (d.primaryInstructorId ?? null) : undefined,
    },
  });
  revalidatePath("/leerlingen");
  revalidatePath(`/leerlingen/${id}`);
  return ok();
}

const availabilitySchema = z.array(
  z.object({ weekday: z.number().int().min(1).max(7), part: z.enum(["MORNING", "AFTERNOON", "EVENING"]) }),
);

/** Replaces the weekly availability grid of a student. */
export async function setAvailabilityAction(studentId: string, cells: unknown) {
  const user = await requireUser();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  const parsed = availabilitySchema.safeParse(cells);
  if (!parsed.success) return fail("invalid");
  await db.$transaction([
    db.studentAvailability.deleteMany({ where: { studentId } }),
    db.studentAvailability.createMany({ data: parsed.data.map((c) => ({ ...c, studentId, schoolId: user.schoolId })) }),
  ]);
  revalidatePath("/leerlingen");
  return ok();
}

export async function setGearboxAction(studentId: string, gearbox: "MANUAL" | "AUTOMATIC") {
  const user = await requireUser();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  if (gearbox !== "MANUAL" && gearbox !== "AUTOMATIC") return fail("invalid");
  await db.student.update({ where: { id: studentId }, data: { gearbox } });
  revalidatePath("/leerlingen");
  return ok();
}

const unavailSchema = z.object({ startsAt: z.string(), endsAt: z.string(), reason: z.string().max(200).optional() });

export async function addUnavailabilityAction(studentId: string, input: z.input<typeof unavailSchema>) {
  const user = await requireUser();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  const p = unavailSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const startsAt = new Date(p.data.startsAt);
  const endsAt = new Date(p.data.endsAt);
  if (!(endsAt > startsAt)) return fail("invalid");
  await db.studentUnavailability.create({
    data: { schoolId: user.schoolId, studentId, startsAt, endsAt, reason: p.data.reason },
  });
  revalidatePath(`/leerlingen/${studentId}`);
  return ok();
}

export async function removeUnavailabilityAction(id: string) {
  const user = await requireUser();
  const row = await db.studentUnavailability.findFirst({ where: { id, schoolId: user.schoolId } });
  if (!row || !(await findStudentFor(user, row.studentId))) return fail("notFound");
  await db.studentUnavailability.delete({ where: { id } });
  revalidatePath(`/leerlingen/${row.studentId}`);
  return ok();
}

const adjustSchema = z.object({
  minutes: z.number().int().min(-6000).max(6000).refine((n) => n !== 0),
  reason: z.string().trim().min(3).max(200),
});

/** Admin: manual hours correction. Needs a reason; recorded in the ledger and the audit log. */
export async function adjustHoursAction(studentId: string, input: z.input<typeof adjustSchema>) {
  const user = await requireAdmin();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  const p = adjustSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  await db.$transaction(async (tx) => {
    await tx.hoursLedgerEntry.create({
      data: { schoolId: user.schoolId, studentId, type: "ADJUST", minutes: p.data.minutes, note: p.data.reason, createdById: user.id },
    });
    await refreshStudentCache(tx, studentId);
    await audit(tx, user, "hours.adjust", "Student", studentId, p.data);
  });
  revalidatePath(`/leerlingen/${studentId}`);
  revalidatePath("/leerlingen");
  return ok();
}

const examSchema = z.object({
  kind: z.enum(["THEORY", "PRACTICAL", "TUSSENTIJDSE_TOETS"]),
  status: z.enum(["REQUESTED", "SCHEDULED", "PASSED", "FAILED", "CANCELLED"]),
  scheduledAt: z.string().optional(),
  cbrLocation: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function saveExamAction(studentId: string, examId: string | null, input: z.input<typeof examSchema>) {
  const user = await requireUser();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  const p = examSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const data = { ...p.data, scheduledAt: p.data.scheduledAt ? new Date(p.data.scheduledAt) : null };
  if (examId) {
    const existing = await db.exam.findFirst({ where: { id: examId, studentId, schoolId: user.schoolId } });
    if (!existing) return fail("notFound");
    await db.exam.update({ where: { id: examId }, data });
  } else {
    const attempts = await db.exam.count({ where: { studentId, kind: data.kind, status: { in: ["PASSED", "FAILED"] } } });
    await db.exam.create({ data: { ...data, schoolId: user.schoolId, studentId, attemptNumber: attempts + 1 } });
  }
  revalidatePath(`/leerlingen/${studentId}`);
  revalidatePath("/leerlingen");
  return ok();
}

/** Reversible alternative to deleting: hides the student from lists (restore via Edit → Status). */
export async function archiveStudentAction(studentId: string) {
  const user = await requireUser();
  if (!(await findStudentFor(user, studentId))) return fail("notFound");
  const future = await db.lesson.count({ where: { studentId, status: "PLANNED", startsAt: { gte: new Date() } } });
  if (future > 0) return fail("hasFutureLessons");
  await db.student.update({ where: { id: studentId }, data: { status: "ARCHIVED" } });
  revalidatePath("/leerlingen");
  revalidatePath(`/leerlingen/${studentId}`);
  return ok();
}

/**
 * Admin: permanently erases a student and everything attached to them (GDPR erasure).
 * Refused when invoices exist, because invoices must be kept for the tax authorities: archive instead.
 * The audit log only stores the id and counts, never personal data.
 */
export async function deleteStudentAction(studentId: string, confirmName: string) {
  const user = await requireAdmin();
  const student = await findStudentFor(user, studentId);
  if (!student) return fail("notFound");
  if (`${student.firstName} ${student.lastName}`.trim().toLowerCase() !== confirmName.trim().toLowerCase()) return fail("nameMismatch");
  if ((await db.invoice.count({ where: { studentId } })) > 0) return fail("hasInvoices");

  const counts = await db.$transaction(async (tx) => {
    // the hours ledger is append-only; erasure is the one sanctioned exception (see migration 0002)
    await tx.$queryRaw`SELECT set_config('app.allow_ledger_delete', 'on', true)`;
    const lessons = await tx.lesson.findMany({ where: { studentId }, select: { id: true } });
    const lessonIds = lessons.map((l) => l.id);
    await tx.hoursLedgerEntry.deleteMany({ where: { OR: [{ studentId }, { lessonId: { in: lessonIds } }] } });
    await tx.skillAssessment.deleteMany({ where: { OR: [{ studentId }, { lessonId: { in: lessonIds } }] } });
    await tx.scheduleDraftItem.deleteMany({ where: { lessonId: { in: lessonIds } } });
    await tx.exam.deleteMany({ where: { OR: [{ studentId }, { lessonId: { in: lessonIds } }] } });
    await tx.theoryEnrollment.deleteMany({ where: { studentId } });
    await tx.lesson.deleteMany({ where: { studentId } });
    await tx.studentPackage.deleteMany({ where: { studentId } });
    await tx.notification.deleteMany({ where: { studentId } });
    await tx.student.delete({ where: { id: studentId } }); // availability, unavailability and skills cascade
    await audit(tx, user, "student.delete", "Student", studentId, { lessons: lessonIds.length });
    return { lessons: lessonIds.length };
  });
  revalidatePath("/leerlingen");
  revalidatePath("/agenda");
  revalidatePath("/lessen");
  revalidatePath("/");
  return ok(counts);
}
