"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TopUpDialog } from "@/components/payments/top-up-dialog";

/** "Stuur aanvulling": opens the dialog where a package is chosen; the student then gets an invoice and an iDEAL link. */
export function TopUpButton({ studentId, name, hoursLeft, packages }: { studentId: string; name: string; hoursLeft: string; packages: { id: string; label: string }[] }) {
  const t = useTranslations("dashboard");
  return <TopUpDialog studentId={studentId} name={name} hoursLeft={hoursLeft} packages={packages} trigger={<Button variant="soft" size="sm">{t("sendTopUp")}</Button>} />;
}
