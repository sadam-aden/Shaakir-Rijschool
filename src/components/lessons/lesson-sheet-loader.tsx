import { getLocale } from "next-intl/server";
import type { SessionUser } from "@/lib/dal/session";
import { getLessonDetail } from "@/lib/queries/lessons";
import { LessonSheet } from "./lesson-sheet";

/** Server wrapper: loads one lesson (role-scoped, 404 when out of scope) and hands it to the client sheet. */
export async function LessonSheetLoader({ user, id }: { user: SessionUser; id: string }) {
  const locale = await getLocale();
  const { lesson: l, skills, vehicles, instructors, cancellationWindowHours, paid } = await getLessonDetail(user, id);
  const progress = new Map(l.student?.skillProgress.map((p) => [p.skillId, p.value]) ?? []);
  return (
    <LessonSheet
      isAdmin={user.role === "ADMIN"}
      cancellationWindowHours={cancellationWindowHours}
      vehicles={vehicles}
      instructors={instructors}
      lesson={{
        id: l.id, type: l.type, status: l.status, startsAt: l.startsAt.toISOString(), endsAt: l.endsAt.toISOString(), durationMin: l.durationMin,
        studentId: l.studentId, studentName: l.student ? `${l.student.firstName} ${l.student.lastName}` : null,
        instructorId: l.instructor.id, instructorName: l.instructor.displayName, vehicleId: l.vehicleId, gearbox: l.gearbox,
        pickupAddress: l.pickupAddress, instructorNotes: l.instructorNotes ?? "", studentNotes: l.studentNotes ?? "",
        title: l.theoryGroup ? (locale === "nl" ? l.theoryGroup.titleNl : l.theoryGroup.titleEn) : null,
        enrollments: l.theoryGroup?.enrollments.map((e) => ({ id: e.id, name: `${e.student.firstName} ${e.student.lastName}`, attendance: e.attendance })) ?? [],
        skills: skills.map((s) => ({ id: s.id, name: locale === "nl" ? s.nameNl : s.nameEn, value: progress.get(s.id) ?? 0 })),
        paid: paid as "PAID" | "PARTIAL" | "UNPAID" | "NONE" | null,
      }}
    />
  );
}
