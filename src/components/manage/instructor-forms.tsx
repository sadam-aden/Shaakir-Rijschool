"use client";

import { Plus, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { inviteInstructorAction } from "@/app/actions/invites";
import { setInstructorActiveAction, setWorkingHoursAction, updateInstructorAction } from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import type { AppLocale } from "@/i18n/config";
import { weekdayShort } from "@/lib/i18n-format";
import { useRunAction } from "@/lib/use-action";

export function InviteDialog() {
  const t = useTranslations("instructors");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { run, pending } = useRunAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="soft"><UserPlus className="h-4 w-4" aria-hidden />{t("invite")}</Button></DialogTrigger>
      <DialogContent title={t("invite")} closeLabel={tc("close")}>
        <div className="space-y-3">
          <Field label={t("inviteForm.name")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("inviteForm.email")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            disabled={pending || !name.trim() || !email.includes("@")}
            onClick={() => run(() => inviteInstructorAction({ name, email }), { success: t("inviteSent"), onOk: () => { setOpen(false); setName(""); setEmail(""); } })}
          >
            {t("inviteForm.send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Profile = { displayName: string; color: string; licenceNumber: string; maxMinutesPerDay: number; homeAddress: string; defaultVehicleId: string };

export function InstructorProfileForm({ id, initial, vehicles }: { id: string; initial: Profile; vehicles: { id: string; name: string }[] }) {
  const t = useTranslations("instructors.detail");
  const tc = useTranslations("common");
  const [v, setV] = useState(initial);
  const { run, pending } = useRunAction();
  const set = <K extends keyof Profile>(k: K, val: Profile[K]) => setV((x) => ({ ...x, [k]: val }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("displayName")}><Input value={v.displayName} onChange={(e) => set("displayName", e.target.value)} /></Field>
      <Field label={t("licence")}><Input value={v.licenceNumber} onChange={(e) => set("licenceNumber", e.target.value)} /></Field>
      <Field label={t("maxPerDay")}><Input type="number" step={30} value={v.maxMinutesPerDay} onChange={(e) => set("maxMinutesPerDay", Number(e.target.value))} /></Field>
      <Field label={t("color")}><Input type="color" value={v.color} onChange={(e) => set("color", e.target.value)} className="h-[42px] p-1" /></Field>
      <Field label={t("homeAddress")} className="sm:col-span-2"><Input value={v.homeAddress} onChange={(e) => set("homeAddress", e.target.value)} /></Field>
      <Field label={t("defaultVehicle")} className="sm:col-span-2">
        <Select value={v.defaultVehicleId} onChange={(e) => set("defaultVehicleId", e.target.value)}>
          <option value="">—</option>
          {vehicles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Button disabled={pending} onClick={() => run(() => updateInstructorAction(id, v), { success: t("saved") })}>{pending ? tc("saving") : tc("confirm")}</Button>
      </div>
    </div>
  );
}

type Row = { weekday: number; startMin: number; endMin: number };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Working hours per weekday; several blocks per day are allowed. */
export function WorkingHoursEditor({ instructorId, initial }: { instructorId: string; initial: Row[] }) {
  const t = useTranslations("instructors.detail");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [rows, setRows] = useState<Row[]>(initial);
  const { run, pending } = useRunAction();

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
        const items = rows.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
        return (
          <div key={wd} className="flex flex-wrap items-center gap-3 rounded-xl bg-page px-3 py-2">
            <span className="w-10 text-sm font-bold">{weekdayShort(wd, locale)}</span>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {items.length === 0 && <span className="text-sm text-muted">{t("closed")}</span>}
              {items.map(({ r, i }) => (
                <span key={i} className="flex items-center gap-1">
                  <Input type="time" step={900} className="w-28 py-1.5" value={toTime(r.startMin)} onChange={(e) => update(i, { startMin: fromTime(e.target.value) })} />
                  –
                  <Input type="time" step={900} className="w-28 py-1.5" value={toTime(r.endMin)} onChange={(e) => update(i, { endMin: fromTime(e.target.value) })} />
                  <Button variant="ghost" size="icon" aria-label={tc("delete")} onClick={() => setRows((x) => x.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
                </span>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRows((x) => [...x, { weekday: wd, startMin: 8 * 60, endMin: 17 * 60 }])}><Plus className="h-3.5 w-3.5" aria-hidden />{t("addRange")}</Button>
          </div>
        );
      })}
      <Button disabled={pending} onClick={() => run(() => setWorkingHoursAction(instructorId, rows), { success: t("saved") })}>{pending ? tc("saving") : tc("confirm")}</Button>
    </div>
  );
}

export function ActiveToggle({ id, active, self }: { id: string; active: boolean; self: boolean }) {
  const t = useTranslations("instructors.detail");
  const { run, pending } = useRunAction();
  if (self) return null;
  return (
    <Button
      variant={active ? "outline" : "primary"} disabled={pending}
      onClick={() => {
        if (active && !window.confirm(t("deactivateConfirm"))) return;
        run(() => setInstructorActiveAction(id, !active), { success: t("saved") });
      }}
    >
      {active ? t("deactivate") : t("activate")}
    </Button>
  );
}
