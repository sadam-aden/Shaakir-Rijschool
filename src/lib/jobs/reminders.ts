import "server-only";
import { paidCentsOf } from "@/lib/dal/invoices";
import { db } from "@/lib/db";
import { daysOverdue, outstandingCents } from "@/lib/domain/money";

/** Highest reminder level already sent + 1 (max 2). */
export const nextManualLevel = (sent: number[]) => Math.min(2, (sent.length ? Math.max(...sent) : 0) + 1);

/** Everyone with an overdue invoice who was not reminded in the last 24 hours (the confirm list shows the same set). */
export async function overdueReminderTargets(schoolId: string, today = new Date()) {
  const invoices = await db.invoice.findMany({
    where: { schoolId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: today } },
    include: { student: { select: { firstName: true, lastName: true } }, payments: true, reminders: true },
    orderBy: { dueDate: "asc" },
  });
  return invoices
    .map((i) => ({
      id: i.id,
      number: i.number,
      student: `${i.student.firstName} ${i.student.lastName}`,
      owedCents: outstandingCents(i.totalCents, paidCentsOf(i.payments)),
      days: daysOverdue(i.dueDate, today),
      level: nextManualLevel(i.reminders.map((r) => r.level)),
      recentlyReminded: i.reminders.some((r) => today.getTime() - r.sentAt.getTime() < 24 * 3_600_000),
    }))
    .filter((i) => i.owedCents > 0 && !i.recentlyReminded);
}
