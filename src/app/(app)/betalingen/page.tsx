import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { BalanceActionButton } from "@/components/payments/balance-action";
import { SendAllRemindersDialog } from "@/components/payments/reminders-dialog";
import { PaidSwitch } from "@/components/payments/paid-switch";
import { RevenueChart } from "@/components/payments/revenue-chart";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import type { AppLocale } from "@/i18n/config";
import { intlTag } from "@/i18n/config";
import { requireAdmin } from "@/lib/dal/session";
import { formatHours, formatMoney } from "@/lib/format";
import { overdueReminderTargets } from "@/lib/jobs/reminders";
import { getPaymentsOverview } from "@/lib/queries/payments";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "unpaid", "low"] as const;
type Filter = (typeof FILTERS)[number];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations("payments");
  const locale = (await getLocale()) as AppLocale;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.f ?? "") ? (sp.f as Filter) : "all";

  const [data, targets] = await Promise.all([getPaymentsOverview(user), overdueReminderTargets(user.schoolId)]);
  const k = data.kpis;
  const rows = data.rows.filter((r) => (filter === "unpaid" ? r.owedCents > 0 : filter === "low" ? r.low : true));
  const money = (c: number) => formatMoney(c, locale);
  const monthName = new Intl.DateTimeFormat(intlTag[locale], { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());
  const pkgOptions = data.packages.map((p) => ({ id: p.id, label: `${locale === "nl" ? p.nameNl : p.nameEn} · ${money(p.priceCents)}` }));
  const lastMonthName = new Intl.DateTimeFormat(intlTag[locale], { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(Number(data.months.at(-2)?.month.slice(0, 4)), Number(data.months.at(-2)?.month.slice(5)) - 1, 15)));

  return (
    <>
      <PageHeader
        title={t("title")}
        eyebrow={monthName}
        hideSearch
        actions={
          <>
            <Button asChild variant="outline"><a href="/api/export/accountant"><Download className="h-4 w-4" aria-hidden />{t("export")}</a></Button>
            <SendAllRemindersDialog targets={targets.map((x) => ({ id: x.id, student: x.student, number: x.number, days: x.days, amount: money(x.owedCents) }))} />
          </>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-primary bg-primary p-5 text-white">
          <div className="text-sm font-semibold text-white/90">{t("kpi.received")}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight">{money(k.receivedCents)}</div>
          <div className="mt-1 text-sm text-white/80">
            {k.deltaPct === null ? "—" : `${t("kpi.vsLast", { pct: `${k.deltaPct > 0 ? "+" : ""}${k.deltaPct}%` })} (${lastMonthName})`}
          </div>
        </div>
        <Card className="p-5">
          <div className="text-sm font-semibold text-muted">{t("kpi.outstanding")}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight">{money(k.outstandingCents)}</div>
          <div className="mt-1 text-sm text-muted">{t("kpi.openOverdue", { open: k.openCount })}{k.overdueCount > 0 && <> · <span className="font-bold text-danger-ink">{t("kpi.overdue", { n: k.overdueCount })}</span></>}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold text-muted">{t("kpi.prepaid")}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight">{formatHours(k.prepaidMinutes, locale)}</div>
          <div className="mt-1 text-sm text-muted">{t("kpi.acrossPackages", { n: k.packageCount })}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold text-muted">{t("kpi.under3")}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-warn-ink">{k.under3Count}</div>
          <div className="mt-1 text-sm text-muted">{t("kpi.topUpReady")}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 p-5">
            <h2 className="text-lg font-bold">{t("balances")}</h2>
            <div className="flex gap-2">
              {FILTERS.map((f) => (
                <Link key={f} href={f === "all" ? "/betalingen" : `/betalingen?f=${f}`} className={cn("rounded-xl border px-3 py-1 text-sm font-semibold", filter === f ? "border-exam bg-exam text-white" : "border-line hover:bg-primary-faint")}>
                  {t(`filters.${f}`)}
                </Link>
              ))}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="p-5 pt-0"><EmptyState>{t("empty")}</EmptyState></div>
          ) : (
            <div role="table">
              <div role="row" className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] gap-3 border-y border-line bg-page/60 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                <span>{t("cols.student")}</span><span>{t("cols.hours")}</span><span>{t("cols.paid")}</span><span>{t("cols.status")}</span><span className="text-right">{t("cols.action")}</span>
              </div>
              {rows.map((r) => {
                const used = Math.max(0, r.minutesPurchased - r.minutesRemaining);
                return (
                  <div key={r.studentId} role="row" className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                    <span className="min-w-0">
                      <Link href={`/leerlingen?id=${r.studentId}`} className="block truncate text-sm font-bold">{r.name}</Link>
                      <span className="block truncate text-xs text-muted">{(locale === "nl" ? r.packageNameNl : r.packageNameEn) ?? t("noPackage")}</span>
                    </span>
                    <span>
                      <span className="flex justify-between text-xs font-bold">
                        <span>{t("hoursUsed", { used: formatHours(used, locale).replace(/ [uh]$/, ""), total: formatHours(r.minutesPurchased, locale).replace(/ [uh]$/, "") })}</span>
                        <span className={r.low ? "text-warn-ink" : "text-primary"}>{t("hoursLeft", { left: formatHours(Math.max(0, r.minutesRemaining), locale) })}</span>
                      </span>
                      <ProgressBar value={used} max={r.minutesPurchased || 1} tone={r.low ? "amber" : "blue"} className="mt-1.5" />
                    </span>
                    <span><span className="block text-sm font-bold">{money(r.paidCents)}</span><span className="block text-xs text-muted">{t("paidOf", { total: money(r.totalCents) })}</span></span>
                    <span>
                      <Badge tone={r.status === "PAID" ? "blue" : r.status === "OVERDUE" ? "red" : r.status === "NONE" ? "grey" : "amber"}>
                        {t(`status.${r.status}`, { days: r.overdueDays })}
                      </Badge>
                    </span>
                    <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                      {r.invoiceId && r.status !== "NONE" && <PaidSwitch invoiceId={r.invoiceId} paid={r.status === "PAID"} name={r.name} amountLabel={money(r.status === "PAID" ? r.totalCents : r.invoiceOwedCents)} />}
                      <BalanceActionButton action={r.action} invoiceId={r.invoiceId} studentId={r.studentId} name={r.name} hoursLeft={formatHours(Math.max(0, r.minutesRemaining), locale)} packages={pkgOptions} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader title={t("revenue")} action={<span className="text-xs font-bold text-primary">{t("last6")}</span>} className="mb-2" />
            <RevenueChart months={data.months} />
          </Card>
          <Card className="p-6">
            <CardHeader title={t("packages")} action={<Link href="/pakketten" className="text-xs font-bold text-primary">{t("editPrices")}</Link>} />
            <ul className="space-y-2">
              {data.packages.map((p) => (
                <li key={p.id} className={cn("flex items-center justify-between rounded-xl px-4 py-3", p.isPopular ? "border border-primary/30 bg-primary-soft" : p.type === "THEORY" ? "bg-warn-soft/50" : "bg-page")}>
                  <span>
                    <span className="block text-sm font-bold">{locale === "nl" ? p.nameNl : p.nameEn}</span>
                    <span className={cn("block text-xs", p.isPopular ? "font-bold text-primary" : "text-muted")}>{(locale === "nl" ? p.descriptionNl : p.descriptionEn) ?? ""}</span>
                  </span>
                  <span className="font-bold">{money(p.priceCents)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
