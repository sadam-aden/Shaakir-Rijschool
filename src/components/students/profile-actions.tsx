"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { addUnavailabilityAction, adjustHoursAction, removeUnavailabilityAction, saveExamAction } from "@/app/actions/students";
import { assignPackageAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { AppLocale } from "@/i18n/config";
import { useRunAction } from "@/lib/use-action";

export function AddPackageDialog({ studentId, packages }: { studentId: string; packages: { id: string; name: string }[] }) {
  const t = useTranslations("students.detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState(packages[0]?.id ?? "");
  const [sendInvoice, setSendInvoice] = useState(true);
  const { run, pending } = useRunAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden />{t("addPackage")}</Button></DialogTrigger>
      <DialogContent title={t("addPackage")} description={t("addPackageHint")} closeLabel={tc("close")}>
        <Field label={t("choosePackage")}>
          <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={sendInvoice} onChange={(e) => setSendInvoice(e.target.checked)} /> {t("sendInvoiceNow")}</label>
        <div className="mt-4 flex justify-end">
          <Button disabled={pending || !pkg} onClick={() => run(() => assignPackageAction(studentId, pkg, sendInvoice), { success: tc("saved"), onOk: () => setOpen(false) })}>
            {tc("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustHoursDialog({ studentId }: { studentId: string }) {
  const t = useTranslations("students.detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending } = useRunAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm">{t("adjustHours")}</Button></DialogTrigger>
      <DialogContent title={t("adjustHours")} closeLabel={tc("close")}>
        <div className="space-y-3">
          <Field label={t("adjustMinutes")}><Input type="number" step={15} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <Field label={t("adjustReason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={pending || !minutes || reason.trim().length < 3}
            onClick={() => run(() => adjustHoursAction(studentId, { minutes: Number(minutes), reason }), { success: tc("saved"), onOk: () => setOpen(false) })}
          >
            {tc("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ExamInit = { id: string; kind: "THEORY" | "PRACTICAL" | "TUSSENTIJDSE_TOETS"; status: "REQUESTED" | "SCHEDULED" | "PASSED" | "FAILED" | "CANCELLED"; scheduledAt: string; cbrLocation: string; notes: string };

/** Local "YYYY-MM-DDTHH:mm" in Amsterdam for <input type="datetime-local">. */
export function ExamDialog({ studentId, exam }: { studentId: string; exam?: ExamInit }) {
  const t = useTranslations("students.detail");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ExamInit>(exam ?? { id: "", kind: "PRACTICAL", status: "SCHEDULED", scheduledAt: "", cbrLocation: "CBR Rotterdam", notes: "" });
  const { run, pending } = useRunAction();
  const set = <K extends keyof ExamInit>(k: K, val: ExamInit[K]) => setV((x) => ({ ...x, [k]: val }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {exam ? <Button variant="ghost" size="sm">{tc("edit")}</Button> : <Button variant="soft" size="sm"><Plus className="h-3.5 w-3.5" aria-hidden />{t("addExam")}</Button>}
      </DialogTrigger>
      <DialogContent title={t("addExam")} closeLabel={tc("close")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tc("name")}>
            <Select value={v.kind} onChange={(e) => set("kind", e.target.value as ExamInit["kind"])}>
              {(["THEORY", "PRACTICAL", "TUSSENTIJDSE_TOETS"] as const).map((k) => <option key={k} value={k}>{t(`examKind.${k}`)}</option>)}
            </Select>
          </Field>
          <Field label={tc("status")}>
            <Select value={v.status} onChange={(e) => set("status", e.target.value as ExamInit["status"])}>
              {(["REQUESTED", "SCHEDULED", "PASSED", "FAILED", "CANCELLED"] as const).map((k) => <option key={k} value={k}>{t(`examStatus.${k}`)}</option>)}
            </Select>
          </Field>
          <Field label={tc("from")}><Input type="datetime-local" value={v.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} /></Field>
          <Field label={t("examLocation")}><Input value={v.cbrLocation} onChange={(e) => set("cbrLocation", e.target.value)} /></Field>
          <Field label={tc("notes")} className="sm:col-span-2"><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => saveExamAction(studentId, exam?.id ?? null, {
                  kind: v.kind, status: v.status, cbrLocation: v.cbrLocation || undefined, notes: v.notes || undefined,
                  scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : undefined,
                }),
                { success: tc("saved"), onOk: () => setOpen(false) },
              )
            }
          >
            {tc("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnavailabilityManager({ studentId, items }: { studentId: string; items: { id: string; startsAt: string; endsAt: string; reason: string | null }[] }) {
  const t = useTranslations("students.detail");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const { run, pending } = useRunAction();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(iso));
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">{t("unavailability")}</h3>
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2">
            <span>{fmt(i.startsAt)} → {fmt(i.endsAt)}{i.reason ? ` · ${i.reason}` : ""}</span>
            <Button variant="ghost" size="icon" aria-label={tc("delete")} onClick={() => run(() => removeUnavailabilityAction(i.id))}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field label={tc("from")}><Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tc("to")}><Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={tc("reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Button
          disabled={pending || !from || !to}
          onClick={() =>
            run(
              () => addUnavailabilityAction(studentId, { startsAt: new Date(from).toISOString(), endsAt: new Date(to).toISOString(), reason: reason || undefined }),
              { success: tc("saved"), onOk: () => { setFrom(""); setTo(""); setReason(""); } },
            )
          }
        >
          {t("addUnavailability")}
        </Button>
      </div>
    </div>
  );
}
