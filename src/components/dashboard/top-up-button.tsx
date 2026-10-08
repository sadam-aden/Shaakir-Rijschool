"use client";

import { useTranslations } from "next-intl";
import { sendTopUpAction } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/lib/use-action";

export function TopUpButton({ studentId }: { studentId: string }) {
  const t = useTranslations("dashboard");
  const { run, pending } = useRunAction();
  return (
    <Button variant="soft" size="sm" disabled={pending} onClick={() => run(() => sendTopUpAction(studentId), { success: t("topUpSent"), refresh: false })}>
      {t("sendTopUp")}
    </Button>
  );
}
