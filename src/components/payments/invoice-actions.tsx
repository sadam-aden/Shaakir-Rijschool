"use client";

import { Banknote, Copy, Download, FileX, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { createIdealLinkAction, markPaidAction, sendInvoiceAction, voidInvoiceAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRunAction } from "@/lib/use-action";

type Props = { invoiceId: string; number: string; owedCents: number; owedLabel: string; voidable: boolean; payable: boolean };

export function InvoiceActions({ invoiceId, number, owedCents, owedLabel, voidable, payable }: Props) {
  const t = useTranslations("payments");
  const ti = useTranslations("payments.invoice");
  const tm = useTranslations("payments.markPaid");
  const tc = useTranslations("common");
  const toast = useToast();
  const { run, pending } = useRunAction();

  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<"CASH" | "PIN" | "BANK_TRANSFER">("CASH");
  const [amount, setAmount] = useState((owedCents / 100).toFixed(2));
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");

  const cents = Math.round(Number(amount.replace(",", ".")) * 100);

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline"><a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" aria-hidden />{ti("download")}</a></Button>
      <Button variant="outline" disabled={pending} onClick={() => run(() => sendInvoiceAction(invoiceId), { success: ti("sent") })}><Mail className="h-4 w-4" aria-hidden />{ti("send")}</Button>

      {payable && (
        <>
          <Button
            variant="outline" disabled={pending}
            onClick={async () => {
              const r = await createIdealLinkAction(invoiceId);
              if (r.ok) {
                await navigator.clipboard?.writeText(r.data.url).catch(() => undefined);
                toast.show("success", ti("linkCopied"));
              }
            }}
          >
            <Copy className="h-4 w-4" aria-hidden />{ti("createLink")}
          </Button>

          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild><Button><Banknote className="h-4 w-4" aria-hidden />{t("actions.markPaid")}</Button></DialogTrigger>
            <DialogContent
              title={tm("title")} description={tm("text", { number, owed: owedLabel })} closeLabel={tc("close")} icon={<Banknote className="h-5 w-5" aria-hidden />}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setPayOpen(false)}>{tc("cancel")}</Button>
                  <Button
                    disabled={pending || !(cents > 0)}
                    onClick={() => run(() => markPaidAction(invoiceId, { method, amountCents: cents }), { success: tm("done"), onOk: () => setPayOpen(false) })}
                  >
                    {tm("confirm")}
                  </Button>
                </>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tm("method")}>
                  <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                    {(["CASH", "PIN", "BANK_TRANSFER"] as const).map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
                  </Select>
                </Field>
                <Field label={tm("amount")}><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {voidable && (
        <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
          <DialogTrigger asChild><Button variant="ghost" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"><FileX className="h-4 w-4" aria-hidden />{ti("void")}</Button></DialogTrigger>
          <DialogContent
            title={ti("voidTitle")} description={ti("voidText")} closeLabel={tc("close")}
            footer={
              <>
                <Button variant="ghost" onClick={() => setVoidOpen(false)}>{tc("cancel")}</Button>
                <Button variant="danger" disabled={pending || reason.trim().length < 3} onClick={() => run(() => voidInvoiceAction(invoiceId, reason), { success: ti("voided"), onOk: () => setVoidOpen(false) })}>{ti("voidConfirm")}</Button>
              </>
            }
          >
            <Field label={ti("voidReason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
