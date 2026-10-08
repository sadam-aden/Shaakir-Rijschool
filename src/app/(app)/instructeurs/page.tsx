import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { InviteDialog } from "@/components/manage/instructor-forms";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, initialsOf } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { startOfIsoWeek } from "@/lib/domain/time";
import { formatNumber } from "@/lib/format";

export default async function InstructorsPage() {
  const user = await requireAdmin();
  const t = await getTranslations("instructors");
  const tr = await getTranslations("roles");
  const locale = (await getLocale()) as AppLocale;
  const weekStart = startOfIsoWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [instructors, lessons, students] = await Promise.all([
    db.instructor.findMany({ where: { schoolId: user.schoolId }, include: { user: { select: { role: true } }, defaultVehicle: true }, orderBy: { displayName: "asc" } }),
    db.lesson.findMany({
      where: { schoolId: user.schoolId, status: { in: ["PLANNED", "COMPLETED"] }, startsAt: { gte: weekStart, lt: weekEnd } },
      select: { instructorId: true, durationMin: true },
    }),
    db.student.groupBy({ by: ["primaryInstructorId"], where: { schoolId: user.schoolId, status: "ACTIVE" }, _count: true }),
  ]);
  const minutes = new Map<string, number>();
  for (const l of lessons) minutes.set(l.instructorId, (minutes.get(l.instructorId) ?? 0) + l.durationMin);
  const studentCount = new Map(students.map((s) => [s.primaryInstructorId, s._count]));

  return (
    <>
      <PageHeader title={t("title")} actions={<InviteDialog />} />
      {instructors.length === 0 ? <EmptyState>{t("empty")}</EmptyState> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {instructors.map((i) => (
            <Link key={i.id} href={`/instructeurs/${i.id}`}>
              <Card className="space-y-4 p-5 transition hover:border-primary">
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(i.displayName)} solid size="lg" />
                  <div>
                    <h2 className="text-lg font-bold">{i.displayName}</h2>
                    <p className="text-sm text-muted">{tr(i.user.role)}</p>
                  </div>
                  {!i.active && <Badge tone="grey" className="ml-auto">{t("inactive")}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-page p-3"><div className="text-lg font-bold">{t("hoursThisWeek", { hours: formatNumber((minutes.get(i.id) ?? 0) / 60, locale, 1) })}</div></div>
                  <div className="rounded-xl bg-page p-3"><div className="text-lg font-bold">{t("studentsCount", { n: studentCount.get(i.id) ?? 0 })}</div></div>
                </div>
                <p className="text-sm text-muted">{t("defaultCar")}: <span className="font-semibold text-ink">{i.defaultVehicle?.name ?? "—"}</span></p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
