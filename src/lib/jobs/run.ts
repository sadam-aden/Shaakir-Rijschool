import "server-only";
import { audit } from "@/lib/dal/audit";
import { paidCentsOf, refreshInvoiceStatus } from "@/lib/dal/invoices";
import { sendReminder } from "@/lib/dal/money-flow";
import { db } from "@/lib/db";
import { summarize } from "@/lib/domain/ledger";
import { daysOverdue, nextReminderLevel } from "@/lib/domain/money";
import { deliverQueuedReminder } from "@/lib/notifications/send";
import { getSchoolSettings } from "@/lib/queries/settings";

/** Sends the queued 24 h lesson reminders that are due. */
export async function sendDueNotifications(now = new Date()) {
  const rows = await db.notification.findMany({
    where: { status: "QUEUED", template: "lesson.reminder24h", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 200,
    select: { id: true, payload: true, channel: true },
  });
  const out = { sent: 0, skipped: 0, failed: 0 };
  for (const r of rows) out[await deliverQueuedReminder(r)]++;
  return out;
}

/** Moves open invoices that are past their due date to OVERDUE. */
export async function markOverdueInvoices(schoolId?: string, now = new Date()) {
  const invoices = await db.invoice.findMany({
    where: { ...(schoolId ? { schoolId } : {}), status: { in: ["OPEN", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    select: { id: true, status: true },
  });
  let changed = 0;
  for (const i of invoices) {
    if ((await refreshInvoiceStatus(db, i.id, now)) !== i.status) changed++;
  }
  return { checked: invoices.length, changed };
}

/** Automatic payment reminders: level 1 after 3 days overdue, level 2 after 10 (configurable), never twice. */
export async function sendPaymentReminders(schoolId: string, now = new Date()) {
  const { settings } = await getSchoolSettings(schoolId);
  const invoices = await db.invoice.findMany({
    where: { schoolId, status: { in: ["OPEN", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now } },
    include: { payments: true, reminders: true },
  });
  const out = { sent: 0, skipped: 0 };
  for (const inv of invoices) {
    if (paidCentsOf(inv.payments) >= inv.totalCents) continue;
    const level = nextReminderLevel(daysOverdue(inv.dueDate, now), inv.reminders.map((r) => r.level), settings.reminderDaysOverdue);
    if (!level) continue;
    const r = await sendReminder({ id: null, schoolId }, inv.id, level, now);
    if (r.ok) out.sent++;
    else out.skipped++;
  }
  return out;
}

/** Nightly check: the cached balances on Student must equal the append-only ledger. Drift is repaired and reported. */
export async function verifyLedger(schoolId: string) {
  const students = await db.student.findMany({
    where: { schoolId },
    select: { id: true, minutesRemaining: true, minutesReserved: true, ledger: { select: { type: true, minutes: true } } },
  });
  const drift: string[] = [];
  for (const s of students) {
    const { remaining, reserved } = summarize(s.ledger);
    if (remaining === s.minutesRemaining && reserved === s.minutesReserved) continue;
    drift.push(s.id);
    await db.student.update({ where: { id: s.id }, data: { minutesRemaining: remaining, minutesReserved: reserved } });
    await audit(db, { id: null, schoolId }, "ledger.drift", "Student", s.id, {
      cached: { remaining: s.minutesRemaining, reserved: s.minutesReserved },
      ledger: { remaining, reserved },
    });
  }
  if (drift.length) {
    const admins = await db.user.findMany({ where: { schoolId, role: "ADMIN", isActive: true }, select: { id: true } });
    await db.inAppNotification.createMany({
      data: admins.map((a) => ({ schoolId, userId: a.id, kind: "ledger.drift", params: { count: drift.length }, href: "/leerlingen" })),
    });
  }
  return { checked: students.length, drift: drift.length };
}

export async function runAllJobs(schoolId?: string) {
  const schools = schoolId ? [{ id: schoolId }] : await db.school.findMany({ select: { id: true } });
  const notifications = await sendDueNotifications();
  const perSchool = [];
  for (const s of schools) {
    perSchool.push({
      schoolId: s.id,
      overdue: await markOverdueInvoices(s.id),
      reminders: await sendPaymentReminders(s.id),
      ledger: await verifyLedger(s.id),
    });
  }
  return { ranAt: new Date().toISOString(), notifications, schools: perSchool };
}
