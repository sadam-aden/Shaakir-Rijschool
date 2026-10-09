"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { sendIdealLinkAction, sendReminderAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import type { BalanceAction } from "@/lib/queries/payments";
import { useRunAction } from "@/lib/use-action";
import { TopUpDialog } from "./top-up-dialog";

/** The one action a balance row needs most: reminder when overdue, iDEAL link when unpaid, top-up when low, else the invoice. */
export function BalanceActionButton({
  action, invoiceId, studentId, name, hoursLeft, packages,
}: {
  action: BalanceAction; invoiceId: string | null; studentId: string; name: string; hoursLeft: string; packages: { id: string; label: string }[];
}) {
  const t = useTranslations("payments");
  const { run, pending } = useRunAction();

  if (action === "sendTopUp") {
    return (
      <TopUpDialog studentId={studentId} name={name} hoursLeft={hoursLeft} packages={packages} trigger={<Button size="sm">{t("actions.sendTopUp")}</Button>} />
    );
  }
  if (action === "sendReminder" && invoiceId) {
    return (
      <Button size="sm" disabled={pending} onClick={() => run(() => sendReminderAction(invoiceId), { success: t("reminderSent") })}>
        {t("actions.sendReminder")}
      </Button>
    );
  }
  if (action === "sendIdeal" && invoiceId) {
    return (
      <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => sendIdealLinkAction(invoiceId), { success: t("linkSent") })}>
        {t("actions.sendIdeal")}
      </Button>
    );
  }
  return invoiceId ? (
    <Button asChild size="sm" variant="outline"><Link href={`/betalingen/facturen/${invoiceId}`}>{t("actions.viewInvoice")}</Link></Button>
  ) : null;
}
