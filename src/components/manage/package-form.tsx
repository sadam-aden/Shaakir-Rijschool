"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { savePackageAction } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import type { PackageInput } from "@/lib/schemas/manage";
import { useRunAction } from "@/lib/use-action";

const empty: PackageInput = {
  nameNl: "", nameEn: "", descriptionNl: "", descriptionEn: "", type: "PRACTICAL", lessonCount: 10, priceEuros: 0,
  vatRate: 21, includesExam: false, isPopular: false, active: true, sortOrder: 10,
};

export function PackageDialog({ id, initial }: { id?: string; initial?: PackageInput }) {
  const t = useTranslations("packages");
  const tf = useTranslations("packages.form");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PackageInput>(initial ?? empty);
  const { run, pending } = useRunAction();
  const set = <K extends keyof PackageInput>(k: K, val: PackageInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const valid = v.nameNl.trim() && v.nameEn.trim() && v.priceEuros >= 0 && v.lessonCount >= 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {id ? <Button variant="ghost" size="sm"><Pencil className="h-3.5 w-3.5" aria-hidden />{tc("edit")}</Button> : <Button variant="soft"><Plus className="h-4 w-4" aria-hidden />{t("add")}</Button>}
      </DialogTrigger>
      <DialogContent title={id ? tc("edit") : t("add")} description={t("editNote")} closeLabel={tc("close")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tf("nameNl")}><Input value={v.nameNl} onChange={(e) => set("nameNl", e.target.value)} /></Field>
          <Field label={tf("nameEn")}><Input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
          <Field label={tf("descNl")}><Input value={v.descriptionNl ?? ""} onChange={(e) => set("descriptionNl", e.target.value)} /></Field>
          <Field label={tf("descEn")}><Input value={v.descriptionEn ?? ""} onChange={(e) => set("descriptionEn", e.target.value)} /></Field>
          <Field label={tf("type")}>
            <Select value={v.type} onChange={(e) => set("type", e.target.value as PackageInput["type"])}>
              {(["PRACTICAL", "THEORY", "EXAM_BUNDLE"] as const).map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
            </Select>
          </Field>
          <Field label={tf("lessonCount")}><Input type="number" min={1} value={v.lessonCount} onChange={(e) => set("lessonCount", Number(e.target.value))} /></Field>
          <Field label={tf("price")}><Input type="number" min={0} step="0.01" value={v.priceEuros} onChange={(e) => set("priceEuros", Number(e.target.value))} /></Field>
          <Field label={tf("vat")}><Input type="number" min={0} value={v.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))} /></Field>
          <Field label={tf("sort")}><Input type="number" min={0} value={v.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></Field>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.includesExam} onChange={(e) => set("includesExam", e.target.checked)} /> {t("includesExam")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.isPopular} onChange={(e) => set("isPopular", e.target.checked)} /> {tf("popular")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> {tf("active")}</label>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={pending || !valid} onClick={() => run(() => savePackageAction(id ?? null, v), { success: t("saved"), onOk: () => setOpen(false) })}>{pending ? tc("saving") : tc("confirm")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
