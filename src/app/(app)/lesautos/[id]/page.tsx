import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DueLine, Plate } from "@/components/manage/bits";
import { PeriodManager } from "@/components/manage/period-manager";
import { VehicleFormDialog } from "@/components/manage/vehicle-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addVehicleUnavailabilityAction, removeVehicleUnavailabilityAction } from "@/app/actions/manage";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { dueState } from "@/lib/domain/due";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("vehicles");
  const tg = await getTranslations("gearbox");
  const v = await db.vehicle.findFirst({
    where: { id, schoolId: user.schoolId },
    include: { unavailability: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }, assignedInstructor: true },
  });
  if (!v) notFound();
  const instructors = await db.instructor.findMany({ where: { schoolId: user.schoolId, active: true }, select: { id: true, displayName: true } });
  const now = new Date();

  return (
    <>
      <PageHeader
        title={v.name}
        eyebrow={<Link href="/lesautos" className="inline-flex items-center gap-1 text-primary"><ArrowLeft className="h-3.5 w-3.5" />{t("title")}</Link>}
        actions={
          <VehicleFormDialog
            id={id} instructors={instructors}
            trigger={<Button variant="outline"><Pencil className="h-4 w-4" aria-hidden />{t("detail.edit")}</Button>}
            initial={{
              name: v.name, licensePlate: v.licensePlate, gearbox: v.gearbox, color: v.color ?? "", dualControl: v.dualControl, status: v.status,
              apkDueDate: iso(v.apkDueDate), nextServiceDate: iso(v.nextServiceDate), insuranceDueDate: iso(v.insuranceDueDate),
              odometerKm: v.odometerKm ?? "", assignedInstructorId: v.assignedInstructorId ?? "",
            }}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit space-y-4 p-6">
          <Plate value={v.licensePlate} />
          <div className="flex gap-2"><Badge tone={v.gearbox === "AUTOMATIC" ? "green" : "grey"}>{tg(v.gearbox)}</Badge><Badge tone={v.status === "ACTIVE" ? "blue" : "amber"}>{t(`status.${v.status}`)}</Badge></div>
          <div className="space-y-1.5">
            <DueLine label={t("apk")} date={v.apkDueDate} state={dueState(v.apkDueDate, now)} />
            <DueLine label={t("service")} date={v.nextServiceDate} state={dueState(v.nextServiceDate, now)} />
            <DueLine label={t("insurance")} date={v.insuranceDueDate} state={dueState(v.insuranceDueDate, now)} />
          </div>
          <p className="text-sm text-muted">{t("assigned")}: <span className="font-semibold text-ink">{v.assignedInstructor?.displayName ?? t("unassigned")}</span></p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-bold">{t("detail.unavailability")}</h2>
          <PeriodManager
            items={v.unavailability.map((u) => ({ id: u.id, startsAt: u.startsAt.toISOString(), endsAt: u.endsAt.toISOString(), reason: u.reason }))}
            addLabel={t("detail.add")} emptyLabel={t("detail.none")}
            add={addVehicleUnavailabilityAction.bind(null, id)} remove={removeVehicleUnavailabilityAction}
          />
        </Card>
      </div>
    </>
  );
}
