"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { saveVehicleAction } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { vehicleSchema, type VehicleData, type VehicleInput } from "@/lib/schemas/manage";
import { useRunAction } from "@/lib/use-action";

export const emptyVehicle: VehicleInput = {
  name: "", licensePlate: "", gearbox: "MANUAL", color: "", dualControl: true, status: "ACTIVE",
  apkDueDate: "", nextServiceDate: "", insuranceDueDate: "", odometerKm: "", assignedInstructorId: "",
};

export function VehicleFormDialog({
  id, initial, instructors, trigger,
}: { id?: string; initial?: VehicleInput; instructors: { id: string; displayName: string }[]; trigger?: ReactNode }) {
  const t = useTranslations("vehicles");
  const tf = useTranslations("vehicles.form");
  const tc = useTranslations("common");
  const tg = useTranslations("gearbox");
  const [open, setOpen] = useState(false);
  const { run, pending } = useRunAction();
  const { register, handleSubmit, formState: { errors } } = useForm<VehicleInput, unknown, VehicleData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: initial ?? emptyVehicle,
  });
  const submit = handleSubmit((v) => run(() => saveVehicleAction(id ?? null, v), { success: t("saved"), onOk: () => setOpen(false) }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="soft"><Plus className="h-4 w-4" aria-hidden />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent title={id ? t("detail.edit") : t("add")} closeLabel={tc("close")}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
          <Field label={tf("name")} error={errors.name && tc("required")} className="sm:col-span-2"><Input {...register("name")} /></Field>
          <Field label={tf("plate")} error={errors.licensePlate && tc("required")}><Input {...register("licensePlate")} /></Field>
          <Field label={tf("color")}><Input {...register("color")} /></Field>
          <Field label={tf("gearbox")}>
            <Select {...register("gearbox")}><option value="MANUAL">{tg("MANUAL")}</option><option value="AUTOMATIC">{tg("AUTOMATIC")}</option></Select>
          </Field>
          <Field label={tf("status")}>
            <Select {...register("status")}>{(["ACTIVE", "IN_MAINTENANCE", "RETIRED"] as const).map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</Select>
          </Field>
          <Field label={tf("apk")}><Input type="date" {...register("apkDueDate")} /></Field>
          <Field label={tf("service")}><Input type="date" {...register("nextServiceDate")} /></Field>
          <Field label={tf("insurance")}><Input type="date" {...register("insuranceDueDate")} /></Field>
          <Field label={tf("odometer")}><Input type="number" {...register("odometerKm", { setValueAs: (v) => (v === "" ? "" : Number(v)) })} /></Field>
          <Field label={tf("instructor")} className="sm:col-span-2">
            <Select {...register("assignedInstructorId")}><option value="">—</option>{instructors.map((i) => <option key={i.id} value={i.id}>{i.displayName}</option>)}</Select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...register("dualControl")} /> {tf("dualControl")}</label>
          <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? tc("saving") : tc("confirm")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
