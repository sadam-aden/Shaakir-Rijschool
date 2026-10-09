"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { sendAllRemindersAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";

export type ReminderTarget = { id: string; student: string; number: string; days: number; amount: string };

/** "Send all reminders" always shows the list first and only sends after confirmation. */
export function SendAllRemindersDialog({ targets }: { targets: ReminderTarget[] }) {
  const t = useTranslations("payments");
  const tr = useTranslations("payments.reminders");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await sendAllRemindersAction();
      if (r.ok) {
        toast.show("success", tr("done", { sent: r.data.sent }));
        if (r.data.skipped) toast.show("error", tr("skipped", { n: r.data.skipped }));
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="soft"><Send className="h-4 w-4" aria-hidden />{t("sendAll")}</Button>
      </DialogTrigger>
      <DialogContent
        title={tr("title")} description={targets.length ? tr("text") : undefined} closeLabel={tc("close")} icon={<Send className="h-5 w-5" aria-hidden />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={busy || targets.length === 0} onClick={send}>{tr("send", { n: targets.length })}</Button>
          </>
        }
      >
        {targets.length === 0 ? (
          <p className="text-sm text-muted">{tr("none")}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {targets.map((x) => (
              <li key={x.id} className="flex items-center justify-between py-2.5">
                <span className="font-semibold">{x.student} <span className="font-normal text-muted">· {x.number}</span></span>
                <span className="text-danger-ink">{tr("line", { days: x.days, amount: x.amount })}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
