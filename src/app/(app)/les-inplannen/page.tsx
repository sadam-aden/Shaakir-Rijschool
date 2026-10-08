import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { PageHeader } from "@/components/shell/page-header";
import { requireUser } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { initialsOf } from "@/components/ui/avatar";
import { localDateKey } from "@/lib/domain/time";
import { getStudentRows } from "@/lib/queries/students";

export default async function BookPage() {
  const user = await requireUser();
  const t = await getTranslations("booking");
  const locale = await getLocale();
  const { rows } = await getStudentRows(user);

  const instructors = await db.instructor.findMany({
    where: { schoolId: user.schoolId, active: true, ...(user.role === "INSTRUCTOR" ? { id: user.instructorId ?? "__none__" } : {}) },
    select: { id: true, displayName: true, workingHours: { select: { weekday: true } } },
    orderBy: { displayName: "asc" },
  });
  const groups = await db.theoryGroup.findMany({
    where: { schoolId: user.schoolId, startsAt: { gte: new Date() }, ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? "__none__" } : {}) },
    orderBy: { startsAt: "asc" },
    take: 12,
    include: { enrollments: { select: { studentId: true } } },
  });

  const students = rows
    .filter((r) => r.status === "ACTIVE")
    .map((r) => ({
      id: r.id, name: `${r.firstName} ${r.lastName}`, initials: initialsOf(r.firstName, r.lastName), gearbox: r.gearbox,
      minutesAvailable: r.minutesAvailable, minutesPurchased: r.minutesPurchased, lessonCount: r.lessonCount,
      availability: r.availability, address: null as string | null, area: r.area,
    }));
  // pick-up defaults to the student's home address
  const addresses = await db.student.findMany({ where: { id: { in: students.map((s) => s.id) } }, select: { id: true, address: true } });
  const addr = new Map(addresses.map((a) => [a.id, a.address]));
  for (const s of students) s.address = addr.get(s.id) ?? null;

  return (
    <>
      <PageHeader
        title={t("title")}
        eyebrow={<><Link href="/agenda" className="text-primary">{t("breadcrumbRoot")}</Link> / {t("breadcrumbCurrent")}</>}
      />
      <BookingWizard
        todayKey={localDateKey(new Date())}
        isAdmin={user.role === "ADMIN"}
        students={students}
        instructors={instructors.map((i) => ({ id: i.id, displayName: i.displayName, workdays: [...new Set(i.workingHours.map((w) => w.weekday))] }))}
        defaultInstructorId={user.instructorId ?? instructors[0]?.id ?? ""}
        theoryGroups={groups.map((g) => ({
          id: g.id, title: locale === "nl" ? g.titleNl : g.titleEn, startsAt: g.startsAt.toISOString(), endsAt: g.endsAt.toISOString(),
          seats: g.enrollments.length, capacity: g.capacity, enrolledStudentIds: g.enrollments.map((e) => e.studentId),
        }))}
      />
    </>
  );
}
