import "server-only";
import type { SessionUser } from "@/lib/dal/session";
import { paidCentsOf } from "@/lib/dal/invoices";
import { db } from "@/lib/db";
import { daysOverdue, deriveInvoiceStatus, outstandingCents, revenueByMonth, type InvoiceStatus } from "@/lib/domain/money";
import { localDateKey } from "@/lib/domain/time";
import { getSchoolSettings } from "./settings";

export type BalanceAction = "viewInvoice" | "sendTopUp" | "sendIdeal" | "sendReminder";

export type BalanceRow = {
  studentId: string;
  name: string;
  packageNameNl: string | null;
  packageNameEn: string | null;
  minutesPurchased: number;
  minutesRemaining: number;
  paidCents: number;
  totalCents: number;
  status: InvoiceStatus | "NONE";
  overdueDays: number;
  owedCents: number;
  /** invoice the action refers to: the one that needs attention, else the latest */
  invoiceId: string | null;
  action: BalanceAction;
  low: boolean;
};

export const monthKey = (d: Date) => localDateKey(d).slice(0, 7);

export async function getPaymentsOverview(user: SessionUser, now = new Date()) {
  const { settings } = await getSchoolSettings(user.schoolId);
  const sixMonthsAgo = new Date(now.getTime() - 200 * 86_400_000);

  const [students, paymentsRecent, packages] = await Promise.all([
    db.student.findMany({
      where: { schoolId: user.schoolId, status: { in: ["ACTIVE", "PAUSED", "WAITING_LIST"] } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        packages: { where: { status: { not: "CANCELLED" } }, orderBy: { purchasedAt: "desc" }, include: { package: true } },
        invoices: { where: { status: { not: "VOID" } }, orderBy: { dueDate: "asc" }, include: { payments: true } },
      },
    }),
    db.payment.findMany({ where: { schoolId: user.schoolId, status: "PAID", paidAt: { gte: sixMonthsAgo } }, select: { amountCents: true, paidAt: true } }),
    db.package.findMany({ where: { schoolId: user.schoolId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const rows: BalanceRow[] = [];
  let outstanding = 0;
  let open = 0;
  let overdue = 0;
  let prepaidMinutes = 0;
  let packageCount = 0;
  let under3 = 0;

  for (const s of students) {
    const activePackages = s.packages.filter((p) => p.status === "ACTIVE");
    const purchased = activePackages.reduce((a, p) => a + p.minutesPurchased, 0);
    if (s.status !== "WAITING_LIST") {
      prepaidMinutes += Math.max(0, s.minutesRemaining);
      if (s.minutesRemaining > 0) packageCount += activePackages.filter((p) => p.minutesPurchased > 0).length;
    }
    const invs = s.invoices.map((i) => {
      const paid = paidCentsOf(i.payments);
      const status = deriveInvoiceStatus({ status: i.status, totalCents: i.totalCents, paidCents: paid, dueDate: i.dueDate }, now);
      return { ...i, paid, owed: outstandingCents(i.totalCents, paid), derived: status };
    });
    for (const i of invs) {
      if (i.owed > 0 && i.derived !== "DRAFT") {
        outstanding += i.owed;
        open++;
        if (i.derived === "OVERDUE") overdue++;
      }
    }
    if (purchased === 0 && invs.length === 0) continue;

    const attention = invs.find((i) => i.owed > 0) ?? invs[invs.length - 1];
    const worst = invs.find((i) => i.derived === "OVERDUE");
    const totalCents = invs.reduce((a, i) => a + i.totalCents, 0);
    const paidCents = invs.reduce((a, i) => a + i.paid, 0);
    const status: BalanceRow["status"] = invs.length === 0 ? "NONE" : worst ? "OVERDUE" : attention.owed > 0 ? (attention.paid > 0 ? "PARTIALLY_PAID" : "OPEN") : "PAID";
    const low = s.track !== "THEORY_ONLY" && purchased > 0 && s.minutesRemaining < 180;
    if (low) under3++;
    const action: BalanceAction = worst ? "sendReminder" : attention && attention.owed > 0 ? "sendIdeal" : low ? "sendTopUp" : "viewInvoice";
    rows.push({
      studentId: s.id, name: `${s.firstName} ${s.lastName}`,
      packageNameNl: activePackages[0]?.package.nameNl ?? null, packageNameEn: activePackages[0]?.package.nameEn ?? null,
      minutesPurchased: purchased, minutesRemaining: s.minutesRemaining, paidCents, totalCents, status,
      overdueDays: worst ? daysOverdue(worst.dueDate, now) : 0, owedCents: invs.reduce((a, i) => a + i.owed, 0),
      invoiceId: attention?.id ?? null, action, low,
    });
  }

  const months = revenueByMonth(paymentsRecent.map((p) => ({ paidAt: p.paidAt!, amountCents: p.amountCents })), now, 6, monthKey);
  const thisMonth = months[months.length - 1]?.cents ?? 0;
  const lastMonth = months[months.length - 2]?.cents ?? 0;

  return {
    kpis: {
      receivedCents: thisMonth, lastMonthCents: lastMonth,
      deltaPct: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
      outstandingCents: outstanding, openCount: open, overdueCount: overdue,
      prepaidMinutes, packageCount, under3Count: under3,
    },
    rows, months, packages, lowHoursMinutes: settings.lowHoursMinutes,
  };
}
