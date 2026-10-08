"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { audit } from "@/lib/dal/audit";
import { findStudentFor } from "@/lib/dal/guards";
import { requireAdmin, requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { refreshStudentCache } from "@/lib/dal/ledger";
import { studentSchema, type StudentInput } from "@/lib/schemas/student";

const COLORS = ["#DBEAFE", "#E0E7FF", "#DCFCE7", "#FEE2E2", "#FEF3C7", "#F3E8FF"];

export async function createStudentAction(input: StudentInput) {
  const user = await requireUser();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;
  const count = await db.student.count({ where: { schoolId: user.schoolId } });
  const s = await db.student.create({
    data: {
      ...d,
      schoolId: user.schoolId,
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      // instructors can only add students for themselves
      primaryInstructorId: user.role === "ADMIN" ? (d.primaryInstructorId ?? null) : user.instructorId,
      avatarColor: COLORS[count % COLORS.length],
    },
  });
  revalidatePath("/leerlingen");
  return ok({ id: s.id });
}

export async function updateStudentAction(id: string, input: StudentInput) {
  const user = await requireUser();
  if (!(await findStudentFor(user, id))) return fail("notFound");
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const d = parsed.data;
  await db.student.update({
    where: { id },
    data: {
      ...d,
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

/** Admin: sell a package to a student. Adds the PURCHASE ledger entry (invoice generation arrives in Phase 2). */
export async function assignPackageAction(studentId: string, packageId: string) {
  const user = await requireAdmin();
  const [student, pkg] = await Promise.all([
    findStudentFor(user, studentId),
    db.package.findFirst({ where: { id: packageId, schoolId: user.schoolId, active: true } }),
  ]);
  if (!student || !pkg) return fail("notFound");
  const minutes = pkg.type === "THEORY" ? 0 : pkg.minutesIncluded;
  await db.$transaction(async (tx) => {
    const sp = await tx.studentPackage.create({
      data: {
        schoolId: user.schoolId, studentId, packageId, priceCents: pkg.priceCents,
        minutesPurchased: minutes, examCredits: pkg.includesExam ? 1 : 0,
      },
    });
    if (minutes > 0) {
      await tx.hoursLedgerEntry.create({
        data: {
          schoolId: user.schoolId, studentId, studentPackageId: sp.id, type: "PURCHASE",
          minutes, note: pkg.nameNl, createdById: user.id,
        },
      });
      await refreshStudentCache(tx, studentId);
    }
    await audit(tx, user, "package.assign", "StudentPackage", sp.id, { packageId, studentId });
  });
  revalidatePath("/leerlingen");
  revalidatePath(`/leerlingen/${studentId}`);
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
