import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DueLine, Plate } from "@/components/manage/bits";
import { VehicleFormDialog } from "@/components/manage/vehicle-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { dueState } from "@/lib/domain/due";
import { startOfIsoWeek } from "@/lib/domain/time";

export default async function VehiclesPage() {
  const user = await requireAdmin();
  const t = await getTranslations("vehicles");
  const tg = await getTranslations("gearbox");
  const now = new Date();
  const weekStart = startOfIsoWeek(now);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);

  const [vehicles, instructors, counts] = await Promise.all([
    db.vehicle.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" }, include: { assignedInstructor: { select: { displayName: true } } } }),
    db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } }),
    db.lesson.groupBy({
      by: ["vehicleId"],
      where: { schoolId: user.schoolId, vehicleId: { not: null }, status: { in: ["PLANNED", "COMPLETED"] }, startsAt: { gte: weekStart, lt: weekEnd } },
      _count: true,
    }),
  ]);
  const perVehicle = new Map(counts.map((c) => [c.vehicleId, c._count]));

  return (
    <>
      <PageHeader title={t("title")} actions={<VehicleFormDialog instructors={instructors} />} />
      {vehicles.length === 0 ? (
        <EmptyState>{t("empty")}</EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/lesautos/${v.id}`} className="block">
              <Card className="space-y-4 p-5 transition hover:border-primary">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{v.name}</h2>
                    <div className="mt-2"><Plate value={v.licensePlate} /></div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone={v.gearbox === "AUTOMATIC" ? "green" : "grey"}>{tg(v.gearbox)}</Badge>
                    <Badge tone={v.status === "ACTIVE" ? "blue" : v.status === "IN_MAINTENANCE" ? "amber" : "grey"}>{t(`status.${v.status}`)}</Badge>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-line pt-3">
                  <DueLine label={t("apk")} date={v.apkDueDate} state={dueState(v.apkDueDate, now)} />
                  <DueLine label={t("service")} date={v.nextServiceDate} state={dueState(v.nextServiceDate, now)} />
                  <DueLine label={t("insurance")} date={v.insuranceDueDate} state={dueState(v.insuranceDueDate, now)} />
                </div>
                <div className="flex justify-between text-sm text-muted">
                  <span>{t("assigned")}: <span className="font-semibold text-ink">{v.assignedInstructor?.displayName ?? t("unassigned")}</span></span>
                  <span>{t("lessonsThisWeek", { n: perVehicle.get(v.id) ?? 0 })}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
