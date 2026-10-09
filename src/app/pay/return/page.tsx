import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { applyPaymentStatus, syncPayment } from "@/lib/dal/invoices";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

/** Where the student lands after paying with iDEAL. Public: the (unguessable) payment id is the key. */
export default async function PayReturnPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment: id } = await searchParams;
  const t = await getTranslations("pay");
  let payment = id ? await db.payment.findUnique({ where: { id }, include: { invoice: { include: { school: true, student: true } } } }) : null;
  if (payment && payment.status === "PENDING") {
    // the webhook may not have arrived yet (or cannot reach localhost): ask the provider now
    await syncPayment(payment.id).catch(() => undefined);
    await applyPaymentStatus(payment.id, "PENDING"); // no-op, keeps the invoice status fresh
    payment = await db.payment.findUnique({ where: { id: payment.id }, include: { invoice: { include: { school: true, student: true } } } });
  }
  const status = payment?.status ?? "NONE";
  const locale = (await getLocale()) as AppLocale;
  const Icon = status === "PAID" ? CheckCircle2 : status === "PENDING" ? Clock : XCircle;
  const tone = status === "PAID" ? "text-success-ink" : status === "PENDING" ? "text-warn-ink" : "text-danger-ink";

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
        <Icon className={`mx-auto h-14 w-14 ${tone}`} aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">{t(`title.${status}`)}</h1>
        <p className="mt-2 text-sm text-muted">{t(`text.${status}`)}</p>
        {payment && (
          <dl className="mt-6 space-y-2 rounded-2xl bg-page p-4 text-left text-sm">
            <div className="flex justify-between"><dt className="text-muted">{t("school")}</dt><dd className="font-bold">{payment.invoice.school.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t("invoice")}</dt><dd className="font-bold">{payment.invoice.number}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t("amount")}</dt><dd className="font-bold">{formatMoney(payment.amountCents, locale)}</dd></div>
          </dl>
        )}
      </div>
    </main>
  );
}
