import "server-only";
import { db } from "@/lib/db";
import type { SessionUser } from "./session";
import { lessonScope, studentScope } from "./scope";

/** Returns the student only if the user may see it (admin: whole school; instructor: assigned or shared lessons). */
export async function findStudentFor(user: SessionUser, id: string) {
  return db.student.findFirst({ where: { id, ...studentScope(user) } });
}

export async function findLessonFor(user: SessionUser, id: string) {
  return db.lesson.findFirst({ where: { id, ...lessonScope(user) } });
}
