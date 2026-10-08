import "server-only";
import { db } from "@/lib/db";
import type { Busy, SlotContext, VehicleCtx } from "@/lib/domain/check-slot";
import { getSchoolSettings } from "@/lib/queries/settings";

const ACTIVE = ["PLANNED", "COMPLETED"] as const;

/** Rough length used to block a student's time for a CBR exam that has no lesson row. */
const EXAM_BLOCK_MIN = 120;

/**
 * Loads everything checkSlot needs for one instructor (and optionally one student) in [from, to).
 * Callers must have authorised access to the instructor and the student already.
 */
export async function loadSlotContext(p: {
  schoolId: string;
  instructorId: string;
  studentId?: string | null;
  from: Date;
  to: Date;
  locale: "nl" | "en";
}): Promise<SlotContext> {
  const { schoolId, instructorId, studentId, from, to, locale } = p;
  const overlap = { startsAt: { lt: to }, endsAt: { gt: from } };

  const [{ settings }, instructor, lessons, vehicles, vehicleLessons] = await Promise.all([
    getSchoolSettings(schoolId),
    db.instructor.findFirstOrThrow({
      where: { id: instructorId, schoolId },
      include: { workingHours: true, timeOff: { where: overlap } },
    }),
    db.lesson.findMany({
      where: { schoolId, instructorId, status: { in: [...ACTIVE] }, ...overlap },
      include: { student: { select: { firstName: true, lat: true, lng: true } }, theoryGroup: { select: { titleNl: true, titleEn: true } } },
    }),
    db.vehicle.findMany({ where: { schoolId }, include: { unavailability: { where: overlap } } }),
    db.lesson.findMany({
      where: { schoolId, vehicleId: { not: null }, status: { in: [...ACTIVE] }, ...overlap },
      select: { id: true, vehicleId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const busy: Busy[] = lessons.map((l) => ({
    id: l.id,
    kind: l.type === "THEORY" ? "THEORY" : l.type === "EXAM" ? "EXAM" : "LESSON",
    label:
      l.type === "THEORY" && l.theoryGroup
        ? locale === "nl" ? l.theoryGroup.titleNl : l.theoryGroup.titleEn
        : (l.student?.firstName ?? ""),
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    lat: l.pickupLat ?? l.student?.lat ?? null,
    lng: l.pickupLng ?? l.student?.lng ?? null,
  }));

  const vehicleCtx: VehicleCtx[] = vehicles.map((v) => ({
    id: v.id, name: v.name, gearbox: v.gearbox, status: v.status, apkDueDate: v.apkDueDate,
    unavailability: v.unavailability.map((u) => ({ startsAt: u.startsAt, endsAt: u.endsAt })),
    busy: vehicleLessons.filter((l) => l.vehicleId === v.id).map((l) => ({ id: l.id, startsAt: l.startsAt, endsAt: l.endsAt })),
  }));

  let student: SlotContext["student"];
  if (studentId) {
    const s = await db.student.findFirstOrThrow({
      where: { id: studentId, schoolId },
      include: {
        availability: true,
        unavailability: { where: overlap },
        lessons: { where: { status: { in: [...ACTIVE] }, ...overlap }, include: { theoryGroup: { select: { titleNl: true, titleEn: true } } } },
        enrollments: { where: { theoryGroup: overlap }, include: { theoryGroup: true } },
        exams: { where: { status: "SCHEDULED", scheduledAt: { gte: from, lt: to } } },
      },
    });
    const studentBusy: Busy[] = [
      ...s.lessons.map((l): Busy => ({ id: l.id, kind: "LESSON", label: "", startsAt: l.startsAt, endsAt: l.endsAt })),
      ...s.enrollments.map((e): Busy => ({ id: `theory-${e.id}`, kind: "THEORY", label: e.theoryGroup.titleNl, startsAt: e.theoryGroup.startsAt, endsAt: e.theoryGroup.endsAt })),
      ...s.exams.filter((e) => e.scheduledAt).map((e): Busy => ({
        id: `exam-${e.id}`, kind: "EXAM", label: "", startsAt: e.scheduledAt!, endsAt: new Date(e.scheduledAt!.getTime() + EXAM_BLOCK_MIN * 60_000),
      })),
    ];
    student = {
      id: s.id,
      availability: s.availability.map((a) => ({ weekday: a.weekday, part: a.part, startMin: a.startMin, endMin: a.endMin })),
      unavailability: s.unavailability.map((u) => ({ startsAt: u.startsAt, endsAt: u.endsAt })),
      minutesAvailable: s.minutesRemaining - s.minutesReserved,
      busy: studentBusy,
    };
  }

  return {
    settings: { travelBufferMin: settings.travelBufferMin },
    instructor: {
      id: instructor.id,
      maxMinutesPerDay: Math.min(instructor.maxMinutesPerDay, settings.maxTeachingMinutesPerDay),
      defaultVehicleId: instructor.defaultVehicleId,
      workingHours: instructor.workingHours.map((w) => ({ weekday: w.weekday, startMin: w.startMin, endMin: w.endMin })),
      timeOff: instructor.timeOff.map((t) => ({ startsAt: t.startsAt, endsAt: t.endsAt })),
      busy,
    },
    student,
    vehicles: vehicleCtx,
  };
}
