"use client";

import { Banknote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { setInvoicePaidAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRunAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";

/** Admin's simple paid / unpaid check for money received in person; asks for confirmation both ways. */
export function PaidSwitch({ invoiceId, paid, name, amountLabel }: { invoiceId: string; paid: boolean; name: string; amountLabel: string }) {
  const t = useTranslations("payments.paid");
  const tc = useTranslations("common");
  const { run, pending } = useRunAction();
  const [open, setOpen] = useState(false);
  const k = paid ? "undo" : "mark";
  return (
    <>
      <button
        type="button" role="switch" aria-checked={paid} aria-label={`${t("switch")} · ${name}`} onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-xs font-bold"
      >
        <span className={cn("relative h-5 w-9 rounded-full transition", paid ? "bg-primary" : "bg-line")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", paid ? "left-[18px]" : "left-0.5")} />
        </span>
        {t("switch")}
      </button>
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
