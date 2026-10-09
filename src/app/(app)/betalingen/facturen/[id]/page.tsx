import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { InvoiceActions } from "@/components/payments/invoice-actions";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/config";
import { paidCentsOf, parseLines } from "@/lib/dal/invoices";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { daysOverdue, deriveInvoiceStatus, invoiceTotals, outstandingCents } from "@/lib/domain/money";
import { formatDateLong, formatMoney, formatTime } from "@/lib/format";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const t = await getTranslations("payments");
  const ti = await getTranslations("payments.invoice");
  const locale = (await getLocale()) as AppLocale;
  const inv = await db.invoice.findFirst({
    where: { id, schoolId: user.schoolId },
    include: { student: true, payments: { orderBy: { createdAt: "desc" } }, reminders: { orderBy: { sentAt: "desc" } } },
  });
  if (!inv) notFound();

  const money = (c: number) => formatMoney(c, locale);
  const lines = parseLines(inv.lines);
  const totals = invoiceTotals(lines);
  const paid = paidCentsOf(inv.payments);
  const owed = outstandingCents(inv.totalCents, paid);
  const now = new Date();
  const status = deriveInvoiceStatus({ status: inv.status, totalCents: inv.totalCents, paidCents: paid, dueDate: inv.dueDate }, now);
  const tone = status === "PAID" ? "green" : status === "OVERDUE" ? "red" : status === "VOID" ? "grey" : "amber";

  return (
    <>
      <PageHeader
        hideSearch
        title={ti("title", { number: inv.number })}
        eyebrow={<Link href="/betalingen" className="inline-flex items-center gap-1 text-primary"><ArrowLeft className="h-3.5 w-3.5" />{ti("back")}</Link>}
        actions={<Badge tone={tone} className="px-4 py-2 text-sm">{t(`status.${status}`, { days: daysOverdue(inv.dueDate, now) })}</Badge>}
      />
      <div className="mb-6"><InvoiceActions invoiceId={inv.id} number={inv.number} owedCents={owed} owedLabel={money(owed)} voidable={paid === 0 && status !== "VOID"} payable={owed > 0 && status !== "VOID"} /></div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-6">
          <dl className="mb-6 grid gap-4 sm:grid-cols-3 text-sm">
            <div><dt className="text-xs font-bold uppercase tracking-wider text-muted">{ti("student")}</dt><dd className="mt-1 font-bold"><Link href={`/leerlingen/${inv.studentId}?tab=payments`} className="text-primary">{inv.student.firstName} {inv.student.lastName}</Link></dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-muted">{ti("issued")}</dt><dd className="mt-1 font-bold">{formatDateLong(inv.issuedAt, locale)}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wider text-muted">{ti("due")}</dt><dd className="mt-1 font-bold">{formatDateLong(inv.dueDate, locale)}</dd></div>
          </dl>
          <h2 className="mb-2 text-sm font-bold">{ti("lines")}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between px-4 py-3 text-sm"><span>{l.quantity > 1 ? `${l.quantity} × ` : ""}{l.description}</span><span className="font-bold">{money(l.unitGrossCents * l.quantity)}</span></li>
            ))}
          </ul>
          <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{ti("subtotal")}</dt><dd>{money(totals.subtotalCents)}</dd></div>
            {totals.vatBreakdown.map((b) => <div key={b.rate} className="flex justify-between"><dt className="text-muted">{ti("vat", { rate: b.rate })}</dt><dd>{money(b.vatCents)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>{ti("total")}</dt><dd>{money(totals.totalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{ti("paid")}</dt><dd className="text-success-ink">{money(Math.min(paid, inv.totalCents))}</dd></div>
            <div className="flex justify-between font-bold"><dt>{ti("outstanding")}</dt><dd className={owed > 0 ? "text-danger-ink" : ""}>{money(owed)}</dd></div>
          </dl>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-bold">{ti("history")}</h2>
            {inv.payments.length === 0 ? <p className="text-sm text-muted">{ti("noPayments")}</p> : (
              <ul className="space-y-2.5">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-page px-3 py-2.5 text-sm">
                    <span>
                      <span className="block font-bold">{t(`methods.${p.method}`)} · {money(p.amountCents)}</span>
                      <span className="block text-xs text-muted">{formatDateLong(p.paidAt ?? p.createdAt, locale)} {formatTime(p.paidAt ?? p.createdAt, locale)}</span>
                    </span>
                    <Badge tone={p.status === "PAID" ? "green" : p.status === "PENDING" ? "amber" : "grey"}>{t(`paymentStatus.${p.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-bold">{ti("remindersTitle")}</h2>
            {inv.reminders.length === 0 ? <p className="text-sm text-muted">{ti("noReminders")}</p> : (
              <ul className="space-y-2 text-sm">
                {inv.reminders.map((r) => (
                  <li key={r.id} className="flex justify-between rounded-xl bg-page px-3 py-2"><span className="font-semibold">{ti("level", { n: r.level })} · {r.channel === "SMS" ? "SMS" : "E-mail"}</span><span className="text-muted">{formatDateLong(r.sentAt, locale)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
