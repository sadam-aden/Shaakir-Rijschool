"use client";

import { Archive, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { archiveStudentAction, deleteStudentAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useRunAction } from "@/lib/use-action";

export function ArchiveStudentButton({ studentId, archived }: { studentId: string; archived: boolean }) {
  const t = useTranslations("students.delete");
  const { run, pending } = useRunAction();
  if (archived) return null;
  return (
    <Button variant="outline" size="sm" disabled={pending} title={t("archiveHint")} onClick={() => run(() => archiveStudentAction(studentId), { success: t("archived") })}>
      <Archive className="h-3.5 w-3.5" aria-hidden />{t("archive")}
    </Button>
  );
}

/** Permanent erasure (admin). The student's full name has to be typed to confirm. */
export function DeleteStudentDialog({ studentId, name }: { studentId: string; name: string }) {
  const t = useTranslations("students.delete");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { run, pending } = useRunAction();
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTyped(""); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"><Trash2 className="h-3.5 w-3.5" aria-hidden />{t("delete")}</Button>
      </DialogTrigger>
      <DialogContent title={t("title")} closeLabel={tc("close")}>
        <p className="text-sm">{t("warn", { name })}</p>
        <p className="mt-2 text-xs text-muted">{t("invoicesNote")}</p>
        <Field label={t("typeName")} className="mt-4"><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
          <Button
            variant="danger" disabled={!matches || pending}
            onClick={() => run(() => deleteStudentAction(studentId, typed), { success: t("deleted"), refresh: false, onOk: () => { setOpen(false); router.push("/leerlingen"); router.refresh(); } })}
          >
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
