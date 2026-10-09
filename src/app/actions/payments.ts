"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok } from "@/lib/action-result";
import { createPaymentLink, sellPackage, recordManualPayment, voidInvoice } from "@/lib/dal/invoices";
import { sendInvoice, sendPaymentLink, sendReminder, sendTopUp } from "@/lib/dal/money-flow";
import { requireAdmin } from "@/lib/dal/session";
import { db } from "@/lib/db";
import { runAllJobs } from "@/lib/jobs/run";
import { nextManualLevel, overdueReminderTargets } from "@/lib/jobs/reminders";

function refresh() {
  revalidatePath("/betalingen");
  revalidatePath("/leerlingen");
  revalidatePath("/");
}

/** Admin: sell a package. Creates the invoice and the hours; optionally e-mails the invoice with an iDEAL link. */
export async function assignPackageAction(studentId: string, packageId: string, sendInvoiceNow = false) {
  const user = await requireAdmin();
  const sold = await sellPackage(user, studentId, packageId);
  if (!sold.ok) return sold;
  let sent = 0;
  if (sendInvoiceNow) {
    const r = await sendInvoice(user, sold.data.invoiceId);
    if (r.ok) sent = r.data.sent;
  }
  refresh();
  revalidatePath(`/leerlingen/${studentId}`);
  return ok({ invoiceId: sold.data.invoiceId, number: sold.data.number, sent });
}

const manualSchema = z.object({
  method: z.enum(["CASH", "PIN", "BANK_TRANSFER"]),
  amountCents: z.number().int().positive(),
});

/** Admin: "mark as paid" for cash, pin or bank transfer (partial amounts allowed). */
export async function markPaidAction(invoiceId: string, input: z.input<typeof manualSchema>) {
  const user = await requireAdmin();
  const p = manualSchema.safeParse(input);
  if (!p.success) return fail("invalid");
  const r = await recordManualPayment(user, invoiceId, p.data);
  if (r.ok) refresh();
  if (r.ok) revalidatePath(`/betalingen/facturen/${invoiceId}`);
  return r;
}

export async function sendInvoiceAction(invoiceId: string) {
  const user = await requireAdmin();
  const r = await sendInvoice(user, invoiceId);
  if (r.ok) refresh();
  return r;
}

/** "Stuur iDEAL-link" */
export async function sendIdealLinkAction(invoiceId: string) {
  const user = await requireAdmin();
  const r = await sendPaymentLink(user, invoiceId);
  if (r.ok) refresh();
  return r;
}

export async function sendReminderAction(invoiceId: string) {
  const user = await requireAdmin();
  const past = await db.paymentReminder.findMany({ where: { invoiceId, schoolId: user.schoolId }, select: { level: true } });
  const r = await sendReminder(user, invoiceId, nextManualLevel(past.map((p) => p.level)));
  if (r.ok) refresh();
  return r;
}

export async function sendAllRemindersAction() {
  const user = await requireAdmin();
  const targets = await overdueReminderTargets(user.schoolId);
  let sent = 0;
  let skipped = 0;
  for (const t of targets) {
    const r = await sendReminder(user, t.id, t.level);
    if (r.ok) sent++;
    else skipped++;
  }
  refresh();
  return ok({ sent, skipped });
}

/** "Stuur aanvulling": sells the chosen package, creates the iDEAL link and sends it to the student. */
export async function topUpAction(studentId: string, packageId: string) {
  const user = await requireAdmin();
  const r = await sendTopUp(user, studentId, packageId);
  if (r.ok) {
    refresh();
    revalidatePath(`/leerlingen/${studentId}`);
  }
  return r;
}

export async function voidInvoiceAction(invoiceId: string, reason: string) {
  const user = await requireAdmin();
  if (reason.trim().length < 3) return fail("invalid");
  const r = await voidInvoice(user, invoiceId, reason.trim());
  if (r.ok) {
    refresh();
    revalidatePath(`/betalingen/facturen/${invoiceId}`);
  }
  return r;
}

/** Runs the background jobs once, right now (the same code the cron route runs). */
export async function runJobsAction() {
  const user = await requireAdmin();
  const result = await runAllJobs(user.schoolId);
  refresh();
  return ok(result);
}

/** Makes (or reuses) the iDEAL link for what is still owed, without sending anything: for copying by hand. */
export async function createIdealLinkAction(invoiceId: string) {
  const user = await requireAdmin();
  const r = await createPaymentLink(user, invoiceId);
  if (r.ok) revalidatePath(`/betalingen/facturen/${invoiceId}`);
  return r;
}
