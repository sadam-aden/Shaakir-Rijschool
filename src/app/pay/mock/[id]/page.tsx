import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { MockCheckoutButtons } from "./mock-buttons";

/**
 * Stand-in for the iDEAL bank screen, only available while no MOLLIE_API_KEY is configured.
 * Lets you walk through "send link → student pays → invoice turns paid" without a payment account.
 */
export default async function MockCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.MOLLIE_API_KEY) notFound();
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { molliePaymentId: id }, include: { invoice: { include: { school: true } } } });
  if (!payment) notFound();
  const t = await getTranslations("pay.mock");
  const locale = (await getLocale()) as AppLocale;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-sm">
        <p className="mb-2 inline-block rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn-ink">{t("badge")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("text")}</p>
        <dl className="my-6 space-y-2 rounded-2xl bg-page p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{payment.invoice.school.name}</dt><dd className="font-bold">{payment.invoice.number}</dd></div>
          <div className="flex justify-between text-lg"><dt className="text-muted">{t("amount")}</dt><dd className="font-bold">{formatMoney(payment.amountCents, locale)}</dd></div>
        </dl>
        {payment.status === "PENDING" ? <MockCheckoutButtons paymentId={payment.id} /> : <p className="text-sm font-semibold">{t("done")}</p>}
      </div>
    </main>
  );
}
