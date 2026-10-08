import "server-only";
import { db } from "@/lib/db";
import { requireUser } from "./session";
import { studentScope } from "./scope";

/** Students visible to the current user (instructors only see their own). */
export async function listStudents() {
  const user = await requireUser();
  return db.student.findMany({
    where: studentScope(user),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true, firstName: true, lastName: true, gearbox: true, status: true,
      minutesRemaining: true, area: true,
    },
  });
}
