"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { saveSchoolAction } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import type { SchoolSettings } from "@/lib/schemas/settings";
import { useRunAction } from "@/lib/use-action";

type School = { name: string; address: string; postcode: string; city: string; kvk: string; btw: string; iban: string; defaultLocale: "nl" | "en" };

export function SettingsForm({ school, settings }: { school: School; settings: SchoolSettings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [s, setS] = useState(school);
  const [r, setR] = useState(settings);
  const { run, pending } = useRunAction();
  const ss = <K extends keyof School>(k: K, v: School[K]) => setS((x) => ({ ...x, [k]: v }));
  const rr = <K extends keyof SchoolSettings>(k: K, v: SchoolSettings[K]) => setR((x) => ({ ...x, [k]: v }));
  const num = (k: keyof SchoolSettings) => (e: React.ChangeEvent<HTMLInputElement>) => rr(k, Number(e.target.value) as never);

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold">{t("school")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("schoolName")} className="sm:col-span-2"><Input value={s.name} onChange={(e) => ss("name", e.target.value)} /></Field>
          <Field label={t("address")}><Input value={s.address} onChange={(e) => ss("address", e.target.value)} /></Field>
          <Field label={t("postcode")}><Input value={s.postcode} onChange={(e) => ss("postcode", e.target.value)} /></Field>
          <Field label={t("city")}><Input value={s.city} onChange={(e) => ss("city", e.target.value)} /></Field>
          <Field label={t("defaultLocale")}>
            <Select value={s.defaultLocale} onChange={(e) => ss("defaultLocale", e.target.value as "nl" | "en")}><option value="nl">Nederlands</option><option value="en">English</option></Select>
          </Field>
          <Field label={t("kvk")}><Input value={s.kvk} onChange={(e) => ss("kvk", e.target.value)} /></Field>
          <Field label={t("btw")}><Input value={s.btw} onChange={(e) => ss("btw", e.target.value)} /></Field>
          <Field label={t("iban")} className="sm:col-span-2"><Input value={s.iban} onChange={(e) => ss("iban", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-bold">{t("rules")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("maxPerDay")}><Input type="number" step={30} value={r.maxTeachingMinutesPerDay} onChange={num("maxTeachingMinutesPerDay")} /></Field>
          <Field label={t("travelBuffer")}><Input type="number" value={r.travelBufferMin} onChange={num("travelBufferMin")} /></Field>
          <Field label={t("lowHours")}><Input type="number" step={30} value={r.lowHoursMinutes} onChange={num("lowHoursMinutes")} /></Field>
        </div>
        <h3 className="pt-2 text-sm font-bold">{t("cancellation")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("cancellationWindow")}><Input type="number" value={r.cancellationWindowHours} onChange={num("cancellationWindowHours")} /></Field>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.reminder24h} onChange={(e) => rr("reminder24h", e.target.checked)} /> {t("reminder24h")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.allowBookingOnUnpaid} onChange={(e) => rr("allowBookingOnUnpaid", e.target.checked)} /> {t("allowUnpaid")}</label>
        </div>
        <h3 className="pt-2 text-sm font-bold">{t("payments")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("vat")}><Input type="number" value={r.vatRate} onChange={num("vatRate")} /></Field>
          <Field label={t("paymentTerm")}><Input type="number" value={r.paymentTermDays} onChange={num("paymentTermDays")} /></Field>
          <Field label={t("smsSender")}><Input maxLength={11} value={r.smsSender} onChange={(e) => rr("smsSender", e.target.value)} /></Field>
        </div>
      </Card>

      <Button
        disabled={pending}
        onClick={() => run(() => saveSchoolAction({ ...s, settings: r }), { success: t("saved") })}
      >
        {pending ? tc("saving") : t("save")}
      </Button>
    </div>
  );
}
