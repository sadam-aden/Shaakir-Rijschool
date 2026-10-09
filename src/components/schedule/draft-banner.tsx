"use client";

import { Check, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { approveDraftAction, discardDraftAction } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { AppLocale } from "@/i18n/config";
import { formatKey } from "@/lib/date-key";
import { formatHours } from "@/lib/format";

export type DraftBannerData = {
  id: string; dateKey: string; instructorName: string; lessons: number; minutes: number; explanation: string | null; partial: boolean;
};

/** One banner per draft waiting for review: summary, Discard, and "Approve & notify students" (with a confirm step). */
export function DraftBanner({ draft, showInstructor }: { draft: DraftBannerData; showInstructor: boolean }) {
  const t = useTranslations("schedule.draft");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const toast = useToast();
  const [approveOpen, setApproveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(true);
  const [reminder, setReminder] = useState(true);

  const day = formatKey(draft.dateKey, locale, { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());

  async function approve() {
    setBusy(true);
    try {
      const r = await approveDraftAction(draft.id, { sms, email, reminder });
      if (!r.ok) {
        toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
        return;
      }
      toast.show("success", t("approved", { n: r.data.approved }));
      if (r.data.failed.length) toast.show("error", t("someFailed", { n: r.data.failed.length }));
      setApproveOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      const r = await discardDraftAction(draft.id);
      if (r.ok) {
        toast.show("success", t("discarded"));
        setDiscardOpen(false);
        router.refresh();
      } else toast.show("error", te.has(r.error) ? te(r.error) : te("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm" aria-label={t("tag")}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Sparkles className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-sm font-bold">
          {t("title", { day })}{showInstructor ? ` · ${draft.instructorName}` : ""} <span className="font-normal text-muted">· {t("summary", { n: draft.lessons, hours: formatHours(draft.minutes, locale) })}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">{draft.explanation ? `${draft.explanation} ` : ""}{t("hint")}{draft.partial ? ` ${t("partial")}` : ""}</p>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogTrigger asChild><Button variant="outline">{t("discard")}</Button></DialogTrigger>
        <DialogContent
          title={t("discardTitle")} description={t("discardText")} closeLabel={tc("close")} icon={<Trash2 className="h-5 w-5" aria-hidden />}
          footer={<><Button variant="ghost" onClick={() => setDiscardOpen(false)}>{tc("cancel")}</Button><Button variant="danger" disabled={busy} onClick={discard}>{t("discard")}</Button></>}
        >
          <p className="text-sm text-muted">{t("summary", { n: draft.lessons, hours: formatHours(draft.minutes, locale) })}</p>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogTrigger asChild><Button><Check className="h-4 w-4" aria-hidden />{t("approve")}</Button></DialogTrigger>
        <DialogContent
          title={t("confirmTitle")} description={t("confirmText", { n: draft.lessons })} closeLabel={tc("close")} icon={<Check className="h-5 w-5" aria-hidden />}
          footer={<><Button variant="ghost" onClick={() => setApproveOpen(false)}>{tc("cancel")}</Button><Button disabled={busy} onClick={approve}>{t("approve")}</Button></>}
        >
          <div className="space-y-3 text-sm font-semibold">
            <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={sms} onChange={(e) => setSms(e.target.checked)} /> {t("notifySms")}</label>
            <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={email} onChange={(e) => setEmail(e.target.checked)} /> {t("notifyEmail")}</label>
            <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> {t("notifyReminder")}</label>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
