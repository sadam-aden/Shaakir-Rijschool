"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { mockPayAction } from "@/app/actions/mock-pay";
import { Button } from "@/components/ui/button";

export function MockCheckoutButtons({ paymentId }: { paymentId: string }) {
  const t = useTranslations("pay.mock");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button disabled={pending} onClick={() => start(() => mockPayAction(paymentId, "paid"))}>{t("pay")}</Button>
      <Button variant="outline" disabled={pending} onClick={() => start(() => mockPayAction(paymentId, "failed"))}>{t("fail")}</Button>
    </div>
  );
}
