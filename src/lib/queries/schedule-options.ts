import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/dal/session";
import { addDays, nextWorkingDay } from "@/lib/date-key";
import { localDateKey } from "@/lib/domain/time";

export type GenerateOptions = {
  instructors: { id: string; name: string; defaultDate: string }[];
  defaultInstructorId: string;
};

/** Who the "Generate schedule" button can plan for, and the first working day after today for each of them. */
export const getGenerateOptions = cache(async (user: SessionUser): Promise<GenerateOptions> => {
  const tomorrow = addDays(localDateKey(new Date()), 1);
  const instructors = await db.instructor.findMany({
    where: { schoolId: user.schoolId, active: true, ...(user.role === "INSTRUCTOR" ? { id: user.instructorId ?? "__none__" } : {}) },
    select: { id: true, displayName: true, workingHours: { select: { weekday: true } } },
    orderBy: { displayName: "asc" },
  });
  const list = instructors.map((i) => ({
    id: i.id, name: i.displayName,
    defaultDate: nextWorkingDay(tomorrow, [...new Set(i.workingHours.map((w) => w.weekday))]),
  }));
  return { instructors: list, defaultInstructorId: user.instructorId ?? list[0]?.id ?? "" };
});
