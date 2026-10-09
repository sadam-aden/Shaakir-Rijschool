import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/action-result";
import { addDays, deriveInvoiceStatus, invoiceNumber, invoiceTotals, lineFromGross, outstandingCents, type InvoiceLine } from "@/lib/domain/money";
import { localParts } from "@/lib/domain/time";
import { getPaymentProvider, toPaymentStatus } from "@/lib/providers/payments";
import { getSchoolSettings } from "@/lib/queries/settings";
import { audit, type Actor } from "./audit";
import { findStudentFor } from "./guards";
import { appendLedger } from "./ledger";
import type { SessionUser } from "./session";

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const isPublicUrl = (u: string) => !/localhost|127\.0\.0\.1|\[::1\]/.test(u);

export const parseLines = (json: unknown): InvoiceLine[] => (Array.isArray(json) ? (json as InvoiceLine[]) : []);

/** Sequential number per school and year (2026-0142). Atomic: concurrent invoices never share a number. */
export async function nextInvoiceNumber(tx: Tx, schoolId: string, issuedAt: Date) {
  const year = localParts(issuedAt).year;
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("schoolId", "year", "last") VALUES (${schoolId}, ${year}, 1)
    ON CONFLICT ("schoolId", "year") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  return invoiceNumber(year, rows[0].last);
}

export const paidCentsOf = (payments: { status: string; amountCents: number }[]) =>
  payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amountCents, 0);

/** Recomputes and stores the invoice status from its payments and due date. */
export async function refreshInvoiceStatus(client: Client, invoiceId: string, today = new Date()) {
  const inv = await client.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  const status = deriveInvoiceStatus({ status: inv.status, totalCents: inv.totalCents, paidCents: paidCentsOf(inv.payments), dueDate: inv.dueDate }, today);
  if (status !== inv.status) await client.invoice.update({ where: { id: invoiceId }, data: { status } });
  return status;
}

/**
 * Sells a package: creates the invoice (prices include VAT), the student's package and the PURCHASE hours in one
 * transaction. Hours exist from the moment of sale; booking is paused while the invoice is overdue (see check-slot rules).
 */
export async function sellPackage(user: SessionUser, studentId: string, packageId: string) {
  const [student, pkg] = await Promise.all([
    findStudentFor(user, studentId),
    db.package.findFirst({ where: { id: packageId, schoolId: user.schoolId, active: true } }),
  ]);
  if (!student || !pkg) return fail("notFound");
  const { settings } = await getSchoolSettings(user.schoolId);
  const locale = student.locale;
  const lines = [lineFromGross(locale === "nl" ? pkg.nameNl : pkg.nameEn, pkg.priceCents, pkg.vatRate)];
  const totals = invoiceTotals(lines);
  const issuedAt = new Date();
  const minutes = pkg.type === "THEORY" ? 0 : pkg.minutesIncluded;

  const result = await db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, user.schoolId, issuedAt);
    const invoice = await tx.invoice.create({
      data: {
        schoolId: user.schoolId, studentId, number, status: totals.totalCents === 0 ? "PAID" : "OPEN", lines, locale,
        subtotalCents: totals.subtotalCents, vatCents: totals.vatCents, totalCents: totals.totalCents,
        issuedAt, dueDate: addDays(issuedAt, settings.paymentTermDays),
      },
    });
    const sp = await tx.studentPackage.create({
      data: { schoolId: user.schoolId, studentId, packageId, priceCents: pkg.priceCents, minutesPurchased: minutes, examCredits: pkg.includesExam ? 1 : 0, invoiceId: invoice.id },
    });
    if (minutes > 0) {
      await appendLedger(tx, { schoolId: user.schoolId, studentId, studentPackageId: sp.id, createdById: user.id, note: pkg.nameNl }, [{ type: "PURCHASE", minutes }]);
    }
    await audit(tx, user, "package.sell", "Invoice", invoice.id, { number, packageId, totalCents: totals.totalCents });
    return { invoiceId: invoice.id, number, studentPackageId: sp.id };
  });
  return ok(result);
}

/** Manual payment (cash, pin, bank transfer). Over-payment is refused. */
export async function recordManualPayment(
  user: SessionUser,
  invoiceId: string,
  input: { method: "CASH" | "PIN" | "BANK_TRANSFER"; amountCents: number; paidAt?: Date },
) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, schoolId: user.schoolId }, include: { payments: true } });
  if (!inv) return fail("notFound");
  if (inv.status === "VOID" || inv.status === "DRAFT") return fail("invalidState");
  const owed = outstandingCents(inv.totalCents, paidCentsOf(inv.payments));
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail("invalid");
  if (input.amountCents > owed) return fail("overpayment");
  const status = await db.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: { schoolId: user.schoolId, invoiceId, method: input.method, amountCents: input.amountCents, status: "PAID", paidAt: input.paidAt ?? new Date() },
    });
    await audit(tx, user, "payment.manual", "Payment", p.id, { invoiceId, method: input.method, amountCents: input.amountCents });
    return refreshInvoiceStatus(tx, invoiceId);
  });
  return ok({ status });
}

/**
 * Creates (or reuses a recent) iDEAL payment for the outstanding amount of an invoice and returns the checkout link.
 * Without a Mollie key the link points to the local mock checkout page.
 */
export async function createPaymentLink(user: Actor, invoiceId: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, schoolId: user.schoolId }, include: { payments: true, student: true } });
  if (!inv) return fail("notFound");
  if (inv.status === "VOID" || inv.status === "DRAFT") return fail("invalidState");
  const owed = outstandingCents(inv.totalCents, paidCentsOf(inv.payments));
  if (owed <= 0) return fail("alreadyPaid");

  const recent = inv.payments.find((p) => p.method === "IDEAL" && p.status === "PENDING" && p.checkoutUrl && p.amountCents === owed && Date.now() - p.createdAt.getTime() < 24 * 3_600_000);
  if (recent?.checkoutUrl) return ok({ paymentId: recent.id, url: recent.checkoutUrl, amountCents: owed });

  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { schoolId: user.schoolId, invoiceId, method: "IDEAL", amountCents: owed, status: "PENDING" } });
  try {
    const base = appUrl();
    const r = await provider.createPayment({
      amountCents: owed, description: `Factuur ${inv.number}`, redirectUrl: `${base}/pay/return?payment=${payment.id}`,
      webhookUrl: isPublicUrl(base) ? `${base}/api/webhooks/mollie` : undefined,
      metadata: { invoiceId, paymentId: payment.id },
    });
    await db.payment.update({ where: { id: payment.id }, data: { molliePaymentId: r.id, checkoutUrl: r.checkoutUrl } });
    await audit(db, user, "payment.link", "Payment", payment.id, { invoiceId, amountCents: owed, provider: provider.name });
    return ok({ paymentId: payment.id, url: r.checkoutUrl, amountCents: owed });
  } catch (e) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    console.error("[payments] could not create payment", e);
    return fail("paymentProvider");
  }
}

/**
 * Applies a provider result to a payment — idempotent (the Mollie webhook can arrive several times) and never
 * downgrades a payment that is already paid.
 */
export async function applyPaymentStatus(paymentId: string, next: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED", paidAt?: Date | null) {
  return db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p) return { changed: false as const, invoiceStatus: null };
    if (p.status === next || p.status === "PAID" || p.status === "REFUNDED") {
      return { changed: false as const, invoiceStatus: await refreshInvoiceStatus(tx, p.invoiceId) };
    }
    await tx.payment.update({ where: { id: paymentId }, data: { status: next, ...(next === "PAID" ? { paidAt: paidAt ?? new Date() } : {}) } });
    if (next === "PAID") {
      await tx.auditLog.create({ data: { schoolId: p.schoolId, userId: null, action: "payment.paid", entity: "Payment", entityId: p.id, data: { invoiceId: p.invoiceId, amountCents: p.amountCents } } });
    }
    return { changed: true as const, invoiceStatus: await refreshInvoiceStatus(tx, p.invoiceId) };
  });
}

/** Fetches the payment from the provider and applies the result (used by the webhook and the return page). */
export async function syncPayment(paymentId: string) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p?.molliePaymentId || p.molliePaymentId.startsWith("mock_")) return { changed: false as const, invoiceStatus: null };
  const remote = await getPaymentProvider().getPayment(p.molliePaymentId);
  return applyPaymentStatus(p.id, toPaymentStatus(remote.status), remote.paidAt);
}

/** Voids an unpaid invoice and takes back its unused hours. */
export async function voidInvoice(user: SessionUser, invoiceId: string, reason: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, schoolId: user.schoolId }, include: { payments: true, packages: true } });
  if (!inv) return fail("notFound");
  if (inv.status === "VOID") return ok();
  if (paidCentsOf(inv.payments) > 0) return fail("hasPayments");
  const student = await db.student.findUniqueOrThrow({ where: { id: inv.studentId } });
  const minutes = inv.packages.reduce((a, p) => a + p.minutesPurchased, 0);
  if (minutes > 0 && student.minutesRemaining - student.minutesReserved < minutes) return fail("hoursInUse");
  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
    await tx.payment.updateMany({ where: { invoiceId, status: "PENDING" }, data: { status: "CANCELLED" } });
    for (const sp of inv.packages) await tx.studentPackage.update({ where: { id: sp.id }, data: { status: "CANCELLED" } });
    if (minutes > 0) await appendLedger(tx, { schoolId: user.schoolId, studentId: inv.studentId, createdById: user.id, note: `void ${inv.number}` }, [{ type: "REFUND", minutes: -minutes }]);
    await audit(tx, user, "invoice.void", "Invoice", invoiceId, { reason, number: inv.number });
  });
  return ok();
}
