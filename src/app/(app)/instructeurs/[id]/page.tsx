import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { addTimeOffAction, removeTimeOffAction } from "@/app/actions/manage";
import { ActiveToggle, InstructorProfileForm, WorkingHoursEditor } from "@/components/manage/instructor-forms";
import { PeriodManager } from "@/components/manage/period-manager";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, initialsOf } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";

export default async function InstructorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("instructors");
  const ins = await db.instructor.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      user: true,
      workingHours: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] },
      timeOff: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } },
      students: { where: { status: "ACTIVE" }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!ins) notFound();
  const vehicles = await db.vehicle.findMany({ where: { schoolId: user.schoolId, status: { not: "RETIRED" } }, select: { id: true, name: true } });

  return (
    <>
      <PageHeader
        title={ins.displayName}
        eyebrow={<Link href="/instructeurs" className="inline-flex items-center gap-1 text-primary"><ArrowLeft className="h-3.5 w-3.5" />{t("title")}</Link>}
        actions={<ActiveToggle id={id} active={ins.active} self={ins.userId === user.id} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Avatar initials={initialsOf(ins.displayName)} solid size="lg" />
            <div><h2 className="text-lg font-bold">{t("detail.profile")}</h2><p className="text-sm text-muted">{ins.user.email}</p></div>
          </div>
          <InstructorProfileForm
            id={id} vehicles={vehicles}
            initial={{ displayName: ins.displayName, color: ins.color, licenceNumber: ins.licenceNumber ?? "", maxMinutesPerDay: ins.maxMinutesPerDay, homeAddress: ins.homeAddress ?? "", defaultVehicleId: ins.defaultVehicleId ?? "" }}
          />
        </Card>
        <Card className="space-y-3 p-6">
          <h2 className="text-lg font-bold">{t("detail.workingHours")}</h2>
          <WorkingHoursEditor instructorId={id} initial={ins.workingHours.map((w) => ({ weekday: w.weekday, startMin: w.startMin, endMin: w.endMin }))} />
        </Card>
        <Card className="space-y-3 p-6">
          <h2 className="text-lg font-bold">{t("detail.timeOff")}</h2>
          <PeriodManager
            items={ins.timeOff.map((o) => ({ id: o.id, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString(), reason: o.reason }))}
            addLabel={t("detail.addTimeOff")} emptyLabel={t("detail.noTimeOff")}
            add={addTimeOffAction.bind(null, id)} remove={removeTimeOffAction}
          />
        </Card>
        <Card className="space-y-3 p-6">
          <h2 className="text-lg font-bold">{t("detail.students")}</h2>
          {ins.students.length === 0 ? <p className="text-sm text-muted">{t("detail.noStudents")}</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {ins.students.map((s) => (
                <li key={s.id}><Link href={`/leerlingen?id=${s.id}`} className="block rounded-xl bg-page px-3 py-2 text-sm font-semibold hover:bg-primary-faint">{s.firstName} {s.lastName}</Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
