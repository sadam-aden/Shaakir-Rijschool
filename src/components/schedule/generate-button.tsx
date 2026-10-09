"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { generateScheduleAction, previewScheduleAction } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { AppLocale } from "@/i18n/config";
import { formatKey } from "@/lib/date-key";
import type { SkipReason } from "@/lib/domain/scheduler";

type Instructor = { id: string; name: string; defaultDate: string };

/** The primary "Planning genereren" button (on every page): choose date(s) and instructor, see what the planner sees, generate. */
export function GenerateScheduleButton({ instructors, defaultInstructorId, isAdmin }: { instructors: Instructor[]; defaultInstructorId: string; isAdmin: boolean }) {
  const t = useTranslations("schedule.dialog");
  const ts = useTranslations("schedule.skip");
  const tt = useTranslations("topbar");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const toast = useToast();

  const first = instructors.find((i) => i.id === defaultInstructorId) ?? instructors[0];
  const [open, setOpen] = useState(false);
  const [instructorId, setInstructorId] = useState(first?.id ?? "");
  const [from, setFrom] = useState(first?.defaultDate ?? "");
  const [to, setTo] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<{ name: string; reason: SkipReason }[] | null>(null);

  const preview = useQuery({
    queryKey: ["schedule-preview", instructorId, from],
    enabled: open && !!instructorId && /^\d{4}-\d{2}-\d{2}$/.test(from),
    queryFn: async () => {
      const r = await previewScheduleAction({ instructorId, dateKey: from });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  const p = preview.data;
  const blockedByDraft = !!p?.pendingDraftId && !replace;

  async function generate() {
    setBusy(true);
    setSkipped(null);
    try {
      const r = await generateScheduleAction({ instructorId, from, to: to || undefined, replace });
      if (!r.ok) {
        toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
        return;
      }
      const made = r.data.days.filter((d) => d.outcome && d.outcome.lessons > 0);
      if (made.length === 0) {
        setSkipped(r.data.days.flatMap((d) => d.outcome?.skipped ?? []));
        const err = r.data.days.find((d) => d.error)?.error;
        toast.show("error", err && te.has(err) ? te(err) : t("nothing"));
        return;
      }
      const total = made.reduce((a, d) => a + (d.outcome?.lessons ?? 0), 0);
      toast.show("success", t("created", { n: total }));
      setOpen(false);
      const qs = new URLSearchParams({ date: made[0].dateKey });
      if (isAdmin) qs.set("instructor", instructorId);
      router.push(`/agenda?${qs}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSkipped(null); }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/30 hover:bg-primary-600">
          <Sparkles className="h-4 w-4" aria-hidden /> {tt("generate")}
        </button>
      </DialogTrigger>
      <DialogContent
        title={t("title")} description={t("subtitle")} closeLabel={tc("close")} icon={<Sparkles className="h-5 w-5" aria-hidden />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={busy || !from || !instructorId || blockedByDraft || p?.workingDay === false} onClick={generate}>
              <Sparkles className="h-4 w-4" aria-hidden />{busy ? t("generating") : t("generate")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("from")}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t("to")}><Input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          {isAdmin && instructors.length > 1 && (
            <Field label={t("instructor")} className="sm:col-span-2">
              <Select value={instructorId} onChange={(e) => { setInstructorId(e.target.value); const d = instructors.find((i) => i.id === e.target.value)?.defaultDate; if (d) setFrom(d); }}>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
          )}
        </div>

        <section className="mt-5 rounded-2xl bg-primary-faint p-4" aria-live="polite">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t("preview")}</h3>
          {preview.isLoading || !p ? (
            <p className="text-sm text-muted">{tc("loading")}</p>
          ) : !p.workingDay ? (
            <p className="text-sm font-semibold text-warn-ink">{t("noWorkingDay")}</p>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-card px-3 py-1.5">{t("studentsAvailable", { n: p.studentsAvailable })}</span>
              <span className="rounded-full bg-card px-3 py-1.5">{t("openSlots", { n: p.openPracticalSlots })}</span>
              {p.theoryGroups > 0 && <span className="rounded-full bg-theory-soft px-3 py-1.5 text-theory-ink">{t("theory", { n: p.theoryGroups })}</span>}
              {p.examNote && <span className="rounded-full bg-exam px-3 py-1.5 text-white">{t("examNote", { name: p.examNote.name, day: formatKey(p.examNote.at.slice(0, 10), locale, { weekday: "long" }) })}</span>}
            </div>
          )}
          {p?.rules && (
            <ul className="mt-3 space-y-1 text-xs text-primary">
              <li className="mb-1 font-bold text-muted">{t("rulesTitle")}</li>
              {[t("ruleAvailability"), t("ruleHours"), t("ruleCar"), t("ruleMaxDay", { hours: p.rules.maxMinutesPerDay / 60 }), t("ruleDrives", { min: p.rules.maxTravelMinutes }), ...(p.rules.examFirst ? [t("ruleExam")] : [])].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check className="h-3 w-3 shrink-0" aria-hidden />{x}</li>
              ))}
            </ul>
          )}
        </section>

        {p?.pendingDraftId && (
          <div role="status" className="mt-4 rounded-2xl border border-warn-ink/30 bg-warn-soft p-4 text-sm">
            <p className="font-semibold text-warn-ink">{t("existing")}</p>
            <label className="mt-2 flex items-center gap-2 font-semibold"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> {t("replace")}</label>
          </div>
        )}

        {skipped && skipped.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t("skipped")}</h3>
            <ul className="space-y-1 text-sm">
              {skipped.map((s) => <li key={s.name} className="flex justify-between rounded-xl bg-page px-3 py-2"><span className="font-semibold">{s.name}</span><span className="text-muted">{ts(s.reason)}</span></li>)}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
