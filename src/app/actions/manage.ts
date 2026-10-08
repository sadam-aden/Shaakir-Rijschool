"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { audit } from "@/lib/dal/audit";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import {
  instructorSchema, packageSchema, schoolFormSchema, timeOffSchema, vehicleSchema, workingHoursSchema,
  type InstructorInput, type PackageInput, type SchoolFormInput, type VehicleInput,
} from "@/lib/schemas/manage";
import { parseSettings } from "@/lib/schemas/settings";

const toDate = (v?: string) => (v ? new Date(v) : null);

// ───────── Vehicles ─────────

export async function saveVehicleAction(id: string | null, input: VehicleInput) {
  const user = await requireAdmin();
  const p = vehicleSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const d = p.data;
  const data = {
    name: d.name, licensePlate: d.licensePlate, gearbox: d.gearbox, color: d.color, dualControl: d.dualControl, status: d.status,
    apkDueDate: toDate(d.apkDueDate), nextServiceDate: toDate(d.nextServiceDate), insuranceDueDate: toDate(d.insuranceDueDate),
    odometerKm: d.odometerKm ?? null, assignedInstructorId: d.assignedInstructorId ?? null,
  };
  if (id) {
    if (!(await db.vehicle.findFirst({ where: { id, schoolId: user.schoolId } }))) return fail("notFound");
    await db.vehicle.update({ where: { id }, data });
  } else {
    await db.vehicle.create({ data: { ...data, schoolId: user.schoolId } });
  }
  revalidatePath("/lesautos");
  return ok();
}

export async function addVehicleUnavailabilityAction(vehicleId: string, input: z.input<typeof timeOffSchema>) {
  const user = await requireAdmin();
  const p = timeOffSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const startsAt = new Date(p.data.startsAt);
  const endsAt = new Date(p.data.endsAt);
  if (!(endsAt > startsAt) || !(await db.vehicle.findFirst({ where: { id: vehicleId, schoolId: user.schoolId } }))) return fail("invalid");
  await db.vehicleUnavailability.create({ data: { schoolId: user.schoolId, vehicleId, startsAt, endsAt, reason: p.data.reason } });
  revalidatePath(`/lesautos/${vehicleId}`);
  return ok();
}

export async function removeVehicleUnavailabilityAction(id: string) {
  const user = await requireAdmin();
  const row = await db.vehicleUnavailability.findFirst({ where: { id, schoolId: user.schoolId } });
  if (!row) return fail("notFound");
  await db.vehicleUnavailability.delete({ where: { id } });
  revalidatePath(`/lesautos/${row.vehicleId}`);
  return ok();
}

// ───────── Instructors ─────────

export async function updateInstructorAction(id: string, input: InstructorInput) {
  const user = await requireAdmin();
  const p = instructorSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  if (!(await db.instructor.findFirst({ where: { id, schoolId: user.schoolId } }))) return fail("notFound");
  const d = p.data;
  await db.instructor.update({
    where: { id },
    data: {
      displayName: d.displayName, color: d.color, licenceNumber: d.licenceNumber ?? null, maxMinutesPerDay: d.maxMinutesPerDay,
      homeAddress: d.homeAddress ?? null, defaultVehicleId: d.defaultVehicleId ?? null,
    },
  });
  revalidatePath(`/instructeurs/${id}`);
  revalidatePath("/instructeurs");
  return ok();
}

/** Replaces all working-hour blocks of an instructor. */
export async function setWorkingHoursAction(instructorId: string, rows: unknown) {
  const user = await requireAdmin();
  const p = workingHoursSchema.safeParse(rows);
  if (!p.success) return fail("invalid");
  if (!(await db.instructor.findFirst({ where: { id: instructorId, schoolId: user.schoolId } }))) return fail("notFound");
  await db.$transaction([
    db.instructorWorkingHours.deleteMany({ where: { instructorId } }),
    db.instructorWorkingHours.createMany({ data: p.data.map((r) => ({ ...r, instructorId, schoolId: user.schoolId })) }),
  ]);
  revalidatePath(`/instructeurs/${instructorId}`);
  return ok();
}

export async function addTimeOffAction(instructorId: string, input: z.input<typeof timeOffSchema>) {
  const user = await requireAdmin();
  const p = timeOffSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const startsAt = new Date(p.data.startsAt);
  const endsAt = new Date(p.data.endsAt);
  if (!(endsAt > startsAt) || !(await db.instructor.findFirst({ where: { id: instructorId, schoolId: user.schoolId } }))) return fail("invalid");
  await db.instructorTimeOff.create({ data: { schoolId: user.schoolId, instructorId, startsAt, endsAt, reason: p.data.reason } });
  revalidatePath(`/instructeurs/${instructorId}`);
  return ok();
}

export async function removeTimeOffAction(id: string) {
  const user = await requireAdmin();
  const row = await db.instructorTimeOff.findFirst({ where: { id, schoolId: user.schoolId } });
  if (!row) return fail("notFound");
  await db.instructorTimeOff.delete({ where: { id } });
  revalidatePath(`/instructeurs/${row.instructorId}`);
  return ok();
}

/** Deactivating also blocks sign-in (the DAL re-reads User.isActive on every request). */
export async function setInstructorActiveAction(id: string, active: boolean) {
  const user = await requireAdmin();
  const ins = await db.instructor.findFirst({ where: { id, schoolId: user.schoolId } });
  if (!ins) return fail("notFound");
  if (ins.userId === user.id) return fail("forbidden");
  await db.$transaction(async (tx) => {
    await tx.instructor.update({ where: { id }, data: { active } });
    await tx.user.update({ where: { id: ins.userId }, data: { isActive: active } });
    await audit(tx, user, active ? "instructor.activate" : "instructor.deactivate", "Instructor", id);
  });
  revalidatePath("/instructeurs");
  revalidatePath(`/instructeurs/${id}`);
  return ok();
}

// ───────── Packages ─────────

export async function savePackageAction(id: string | null, input: PackageInput) {
  const user = await requireAdmin();
  const p = packageSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const { priceEuros, ...rest } = p.data;
  const data = {
    ...rest,
    descriptionNl: rest.descriptionNl ?? null,
    descriptionEn: rest.descriptionEn ?? null,
    priceCents: Math.round(priceEuros * 100),
    // one practical lesson is 60 minutes; theory packages carry no practical minutes
    minutesIncluded: rest.type === "THEORY" ? 0 : rest.lessonCount * 60,
    includesExam: rest.type === "EXAM_BUNDLE" ? true : rest.includesExam,
  };
  if (id) {
    if (!(await db.package.findFirst({ where: { id, schoolId: user.schoolId } }))) return fail("notFound");
    await db.package.update({ where: { id }, data });
  } else {
    await db.package.create({ data: { ...data, schoolId: user.schoolId } });
  }
  revalidatePath("/pakketten");
  return ok();
}

// ───────── School settings ─────────

export async function saveSchoolAction(input: SchoolFormInput) {
  const user = await requireAdmin();
  const p = schoolFormSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const school = await db.school.findUniqueOrThrow({ where: { id: user.schoolId } });
  const { settings, ...fields } = p.data;
  await db.school.update({
    where: { id: user.schoolId },
    data: {
      name: fields.name, address: fields.address ?? null, postcode: fields.postcode ?? null, city: fields.city ?? null,
      kvk: fields.kvk ?? null, btw: fields.btw ?? null, iban: fields.iban ?? null, defaultLocale: fields.defaultLocale,
      settings: { ...parseSettings(school.settings), ...settings },
    },
  });
  revalidatePath("/", "layout");
  return ok();
}
