import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { lessonScope } from "@/lib/dal/scope";
import { paymentSummary } from "@/lib/queries/students";
import { getSchoolSettings } from "./settings";

export type LessonFilters = {
  status?: string; instructorId?: string; type?: string; from?: string; to?: string; needsCheckOff?: boolean; page?: number;
};

export const LESSON_PAGE_SIZE = 40;

export async function getLessonList(user: SessionUser, f: LessonFilters) {
  const where: Prisma.LessonWhereInput = { ...lessonScope(user) };
  if (f.status && f.status !== "all") where.status = f.status as Prisma.LessonWhereInput["status"];
  if (f.type && f.type !== "all") where.type = f.type as Prisma.LessonWhereInput["type"];
  if (f.instructorId && user.role === "ADMIN") where.instructorId = f.instructorId;
  if (f.from || f.to) where.startsAt = { ...(f.from ? { gte: new Date(`${f.from}T00:00:00Z`) } : {}), ...(f.to ? { lt: new Date(new Date(`${f.to}T00:00:00Z`).getTime() + 86_400_000) } : {}) };
  if (f.needsCheckOff) {
    where.status = "PLANNED";
    where.endsAt = { lt: new Date() };
  }
  const page = Math.max(1, f.page ?? 1);
  const [rows, total] = await Promise.all([
    db.lesson.findMany({
      where, orderBy: { startsAt: f.needsCheckOff ? "asc" : "desc" }, skip: (page - 1) * LESSON_PAGE_SIZE, take: LESSON_PAGE_SIZE,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        instructor: { select: { displayName: true } },
        vehicle: { select: { name: true } },
        theoryGroup: { select: { titleNl: true, titleEn: true } },
      },
    }),
    db.lesson.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / LESSON_PAGE_SIZE)) };
}

/** Everything the lesson sheet needs. Throws 404 when out of scope. */
export async function getLessonDetail(user: SessionUser, id: string) {
  const lesson = await db.lesson.findFirst({
    where: { id, ...lessonScope(user) },
    include: {
      student: {
        include: {
          skillProgress: true,
          packages: { include: { invoice: { include: { payments: true } } } },
        },
      },
      instructor: { select: { id: true, displayName: true } },
      vehicle: { select: { id: true, name: true, gearbox: true } },
      theoryGroup: { include: { enrollments: { include: { student: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  if (!lesson) notFound();
  const [skills, vehicles, instructors, { settings }] = await Promise.all([
    db.skill.findMany({ where: { schoolId: user.schoolId }, orderBy: { sortOrder: "asc" } }),
    db.vehicle.findMany({ where: { schoolId: user.schoolId, status: "ACTIVE" }, select: { id: true, name: true, gearbox: true } }),
    user.role === "ADMIN" ? db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } }) : Promise.resolve([]),
    getSchoolSettings(user.schoolId),
  ]);
  const paid = lesson.student ? paymentSummary(user, lesson.student.packages).state : null;
  return { lesson, skills, vehicles, instructors, cancellationWindowHours: settings.cancellationWindowHours, paid };
}
