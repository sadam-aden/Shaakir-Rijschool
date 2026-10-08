"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { findLessonFor, findStudentFor } from "@/lib/dal/guards";
import { bookLesson, cancelLesson, completeLesson, markNoShow, moveLesson } from "@/lib/dal/lessons";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import type { BookLessonInput, CancelLessonInput, CompleteLessonInput, MoveLessonInput } from "@/lib/schemas/lesson";

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/lessen");
  revalidatePath("/leerlingen");
  revalidatePath("/");
}

export async function bookLessonAction(input: BookLessonInput) {
  const user = await requireUser();
  const locale = (await getLocale()) as "nl" | "en";
  const r = await bookLesson(user, input, locale);
  if (r.ok) refresh();
  return r;
}

export async function moveLessonAction(input: MoveLessonInput) {
  const user = await requireUser();
  const locale = (await getLocale()) as "nl" | "en";
  const r = await moveLesson(user, input, locale);
  if (r.ok) refresh();
  return r;
}

export async function completeLessonAction(input: CompleteLessonInput) {
  const user = await requireUser();
  const r = await completeLesson(user, input);
  if (r.ok) refresh();
  return r;
}

export async function markNoShowAction(lessonId: string, chargeable?: boolean) {
  const user = await requireUser();
  const r = await markNoShow(user, lessonId, chargeable);
  if (r.ok) refresh();
  return r;
}

export async function cancelLessonAction(input: CancelLessonInput) {
  const user = await requireUser();
  const r = await cancelLesson(user, input);
  if (r.ok) refresh();
  return r;
}

/** Bulk check-off: completes every selected lesson that is still planned (no skill updates). */
export async function bulkCompleteAction(lessonIds: string[]) {
  const user = await requireUser();
  const ids = z.array(z.string()).max(100).parse(lessonIds);
  let done = 0;
  for (const lessonId of ids) {
    const r = await completeLesson(user, { lessonId, skills: [] });
    if (r.ok) done++;
  }
  refresh();
  return ok({ done });
}

const attendanceSchema = z.array(z.object({ enrollmentId: z.string(), attendance: z.enum(["ENROLLED", "ATTENDED", "NO_SHOW"]) }));

/** Theory attendance checklist for a theory lesson. */
export async function setAttendanceAction(lessonId: string, rows: unknown) {
  const user = await requireUser();
  const lesson = await findLessonFor(user, lessonId);
  if (!lesson?.theoryGroupId) return fail("notFound");
  const p = attendanceSchema.safeParse(rows);
  if (!p.success) return fail("invalid");
  await db.$transaction(
    p.data.map((r) =>
      db.theoryEnrollment.updateMany({ where: { id: r.enrollmentId, theoryGroupId: lesson.theoryGroupId! }, data: { attendance: r.attendance } }),
    ),
  );
  refresh();
  return ok();
}

/** Enrol a student in a theory group (no hours are used). */
export async function enrollTheoryAction(studentId: string, theoryGroupId: string) {
  const user = await requireUser();
  const student = await findStudentFor(user, studentId);
  const group = await db.theoryGroup.findFirst({
    where: { id: theoryGroupId, schoolId: user.schoolId, ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? "__none__" } : {}) },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!student || !group) return fail("notFound");
  if (group._count.enrollments >= group.capacity) return fail("groupFull");
  const existing = await db.theoryEnrollment.findUnique({ where: { theoryGroupId_studentId: { theoryGroupId, studentId } } });
  if (existing) return ok();
  await db.theoryEnrollment.create({ data: { schoolId: user.schoolId, theoryGroupId, studentId } });
  refresh();
  return ok();
}

const notesSchema = z.object({ lessonId: z.string(), instructorNotes: z.string().max(2000).optional(), studentNotes: z.string().max(2000).optional() });

/** Save notes on a lesson without changing its status. */
export async function saveLessonNotesAction(input: z.input<typeof notesSchema>) {
  const user = await requireUser();
  const p = notesSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  if (!(await findLessonFor(user, p.data.lessonId))) return fail("notFound");
  await db.lesson.update({ where: { id: p.data.lessonId }, data: { instructorNotes: p.data.instructorNotes, studentNotes: p.data.studentNotes } });
  refresh();
  return ok();
}
