"use client";

import { PlayCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { runJobsAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useRunAction } from "@/lib/use-action";

/** Runs the same code as the cron route once, right now: due reminders, overdue invoices, payment reminders, ledger check. */
export function RunJobsCard() {
  const t = useTranslations("settings.jobs");
  const toast = useToast();
  const { run, pending } = useRunAction();
  return (
    <Card className="space-y-3 p-6">
      <h2 className="text-lg font-bold">{t("title")}</h2>
      <p className="text-sm text-muted">{t("text")}</p>
      <Button
        variant="soft" disabled={pending}
        onClick={() =>
          run(() => runJobsAction(), {
            onOk: (r) => {
              const s = r.schools[0];
              toast.show("success", t("done", {
                reminders: r.notifications.sent, overdue: s?.overdue.changed ?? 0, payments: s?.reminders.sent ?? 0, drift: s?.ledger.drift ?? 0,
              }));
            },
          })
        }
      >
        <PlayCircle className="h-4 w-4" aria-hidden />{t("run")}
      </Button>
    </Card>
  );
}
