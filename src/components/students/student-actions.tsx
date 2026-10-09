import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { studentToFormValues } from "@/lib/student-form";
import { ArchiveStudentButton, DeleteStudentDialog } from "./delete-student";
import { StudentFormDialog } from "./student-form";

type Student = Parameters<typeof studentToFormValues>[0] & { id: string };

/** Edit / archive / delete buttons shown under the student panel (delete is admin only). */
export async function StudentActions({ student, user }: { student: Student; user: SessionUser }) {
  const t = await getTranslations("students.delete");
  const isAdmin = user.role === "ADMIN";
  const instructors = isAdmin
    ? await db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } })
    : [];
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <StudentFormDialog
        key={student.id}
        mode="edit" studentId={student.id} initial={studentToFormValues(student)} instructors={instructors} isAdmin={isAdmin}
        trigger={<Button variant="soft" size="sm"><Pencil className="h-3.5 w-3.5" aria-hidden />{t("edit")}</Button>}
      />
      <ArchiveStudentButton studentId={student.id} archived={student.status === "ARCHIVED"} />
      {isAdmin && <DeleteStudentDialog studentId={student.id} name={`${student.firstName} ${student.lastName}`} />}
    </div>
  );
}
