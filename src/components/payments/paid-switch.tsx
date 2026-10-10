"use client";

import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { setInvoicePaidAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRunAction } from "@/lib/use-action";

/** Admin's simple paid / unpaid checkbox for money received in person; asks for confirmation both ways. */
export function PaidSwitch({ invoiceId, paid, name, amountLabel }: { invoiceId: string; paid: boolean; name: string; amountLabel: string }) {
  const t = useTranslations("payments.paid");
  const tc = useTranslations("common");
  const { run, pending } = useRunAction();
  const [open, setOpen] = useState(false);
  const k = paid ? "undo" : "mark";
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
        <input
          type="checkbox" checked={paid} onChange={() => setOpen(true)} aria-label={`${t("switch")} · ${name}`}
          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
        />
        {t("switch")}
      </label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={t(`${k}Title`)} description={t(`${k}Text`, { name, amount: amountLabel })} closeLabel={tc("close")} icon={<Banknote className="h-5 w-5" aria-hidden />}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button disabled={pending} onClick={() => run(() => setInvoicePaidAction(invoiceId, !paid), { success: t(`${k}Done`), onOk: () => setOpen(false) })}>{t(`${k}Confirm`)}</Button>
            </>
          }
        >
          <span />
        </DialogContent>
      </Dialog>
    </>
  );
}
