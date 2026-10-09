"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { topUpAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRunAction } from "@/lib/use-action";

/** "Stuur aanvulling": pick a package; the student gets an invoice and an iDEAL link (by SMS/e-mail, with consent). */
export function TopUpDialog({
  studentId, name, hoursLeft, packages, defaultPackageId, trigger,
}: {
  studentId: string; name: string; hoursLeft: string; packages: { id: string; label: string }[]; defaultPackageId?: string; trigger: ReactNode;
}) {
  const t = useTranslations("payments.topUp");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pkg, setPkg] = useState(defaultPackageId ?? packages[0]?.id ?? "");
  const toast = useToast();
  const { run, pending } = useRunAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={t("title")} description={t("text", { name, hours: hoursLeft })} closeLabel={tc("close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button
              disabled={pending || !pkg}
              onClick={() => run(() => topUpAction(studentId, pkg), { onOk: (d) => { setOpen(false); toast.show("success", t("done", { number: d.invoiceNumber })); } })}
            >
              {t("send")}
            </Button>
          </>
        }
      >
        <Field label={t("package")}>
          <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      </DialogContent>
    </Dialog>
  );
}
