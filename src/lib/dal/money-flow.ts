import "server-only";
import type { AppLocale } from "@/i18n/config";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/action-result";
import { daysOverdue, invoiceTotals, outstandingCents } from "@/lib/domain/money";
import { formatDateLong, formatDateShort, formatHours, formatMoney } from "@/lib/format";
import { invoiceMessage, paymentLinkMessage, reminderMessage, topUpOfferMessage } from "@/lib/notifications/templates";
import { sendStudentMessage } from "@/lib/notifications/send";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { storage } from "@/lib/providers/storage";
import { getSchoolSettings } from "@/lib/queries/settings";
import type { Actor } from "./audit";
import { createPaymentLink, paidCentsOf, parseLines, sellPackage } from "./invoices";
import { findStudentFor } from "./guards";
import type { SessionUser } from "./session";

/** Renders the invoice PDF in the student's language and stores a copy (pdfUrl). */
export async function buildInvoicePdf(invoiceId: string, schoolId: string) {
  const inv = await db.invoice.findFirst({
    where: { id: invoiceId, schoolId },
    include: { student: true, payments: true, school: true },
  });
  if (!inv) return null;
  const { settings } = await getSchoolSettings(schoolId);
  const lines = parseLines(inv.lines);
  const open = inv.payments.filter((p) => p.method === "IDEAL" && p.status === "PENDING" && p.checkoutUrl).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  const buffer = await renderInvoicePdf({
    locale: inv.locale, number: inv.number, issuedAt: inv.issuedAt, dueDate: inv.dueDate, paidCents: paidCentsOf(inv.payments),
    paymentTermDays: settings.paymentTermDays,
    school: { name: inv.school.name, address: inv.school.address, postcode: inv.school.postcode, city: inv.school.city, kvk: inv.school.kvk, btw: inv.school.btw, iban: inv.school.iban },
    customer: { name: `${inv.student.firstName} ${inv.student.lastName}`, address: inv.student.address, postcode: inv.student.postcode, city: inv.student.city, email: inv.student.email },
    lines, totals: invoiceTotals(lines), payUrl: open?.checkoutUrl ?? null, void: inv.status === "VOID",
  });
  const key = `invoices/${schoolId}/${inv.number}.pdf`;
  try {
    await storage.put(key, buffer);
    if (inv.pdfUrl !== key) await db.invoice.update({ where: { id: inv.id }, data: { pdfUrl: key } });
  } catch {
    // read-only filesystems (serverless): the PDF is rendered on demand anyway
  }
  return { buffer, filename: `${inv.number}.pdf`, invoice: inv };
}

async function loadInvoice(schoolId: string, invoiceId: string) {
  return db.invoice.findFirst({ where: { id: invoiceId, schoolId }, include: { student: true, payments: true, packages: { include: { package: true } } } });
}

const when = (d: Date, locale: AppLocale, long: boolean) => (long ? formatDateLong(d, locale) : formatDateShort(d, locale));

/** E-mails the invoice (PDF attached) and texts the iDEAL link; respects consent. */
export async function sendInvoice(actor: Actor, invoiceId: string) {
  const inv = await loadInvoice(actor.schoolId, invoiceId);
  if (!inv) return fail("notFound");
  const link = await createPaymentLink(actor, invoiceId);
  const payUrl = link.ok ? link.data.url : null;
  const built = await buildInvoicePdf(invoiceId, actor.schoolId); // after the link exists so the PDF carries it
  const r = await sendStudentMessage(inv.studentId, "invoice", ({ locale, school, studentName }) => ({
    ...invoiceMessage(locale, {
      school, studentName, number: inv.number, total: formatMoney(inv.totalCents, locale), owed: formatMoney(outstandingCents(inv.totalCents, paidCentsOf(inv.payments)), locale),
      due: when(inv.dueDate, locale, true), payUrl, description: parseLines(inv.lines)[0]?.description,
    }),
    attachments: built ? [{ filename: built.filename, content: built.buffer, contentType: "application/pdf" }] : undefined,
  }));
  return r.sent === 0 ? fail("noConsent") : ok({ sent: r.sent });
}

/** "Stuur iDEAL-link": payment link for what is still owed, by SMS and e-mail. */
export async function sendPaymentLink(actor: Actor, invoiceId: string) {
  const inv = await loadInvoice(actor.schoolId, invoiceId);
  if (!inv) return fail("notFound");
  const link = await createPaymentLink(actor, invoiceId);
  if (!link.ok) return link;
  const r = await sendStudentMessage(inv.studentId, "payment-link", ({ locale, school, studentName }) =>
    paymentLinkMessage(locale, {
      school, studentName, number: inv.number, total: formatMoney(inv.totalCents, locale), owed: formatMoney(link.data.amountCents, locale),
      due: when(inv.dueDate, locale, true), payUrl: link.data.url,
    }),
  );
  return r.sent === 0 ? fail("noConsent") : ok({ sent: r.sent, url: link.data.url });
}

/** Payment reminder (level 1 or 2) with a fresh iDEAL link; every sent channel is recorded in PaymentReminder. */
export async function sendReminder(actor: Actor, invoiceId: string, level = 1, today = new Date()) {
  const inv = await loadInvoice(actor.schoolId, invoiceId);
  if (!inv) return fail("notFound");
  const owed = outstandingCents(inv.totalCents, paidCentsOf(inv.payments));
  if (owed <= 0 || inv.status === "VOID") return fail("alreadyPaid");
  const link = await createPaymentLink(actor, invoiceId);
  const payUrl = link.ok ? link.data.url : null;
  const days = daysOverdue(inv.dueDate, today);
  const r = await sendStudentMessage(inv.studentId, `payment-reminder-${level}`, ({ locale, school, studentName }) =>
    reminderMessage(locale, level, { school, studentName, number: inv.number, total: formatMoney(inv.totalCents, locale), owed: formatMoney(owed, locale), due: when(inv.dueDate, locale, true), payUrl, days }),
  );
  if (r.sent === 0) return fail("noConsent");
  await db.paymentReminder.createMany({ data: r.channels.map((channel) => ({ schoolId: actor.schoolId, invoiceId, channel, level })) });
  return ok({ sent: r.sent });
}

/**
 * Top-up: sells the chosen package (invoice + hours), creates the iDEAL link and sends it to the student.
 * If nothing can be delivered (no consent), nothing is sold.
 */
export async function sendTopUp(user: SessionUser, studentId: string, packageId: string) {
  const student = await findStudentFor(user, studentId);
  const pkg = await db.package.findFirst({ where: { id: packageId, schoolId: user.schoolId, active: true } });
  if (!student || !pkg) return fail("notFound");
  const canEmail = student.emailConsent && !!student.email;
  const canSms = student.smsConsent && !!student.phone;
  if (!canEmail && !canSms) return fail("noConsent");

  const leftBefore = student.minutesRemaining - student.minutesReserved;
  const sold = await sellPackage(user, studentId, packageId);
  if (!sold.ok) return sold;
  const link = await createPaymentLink(user, sold.data.invoiceId);
  if (!link.ok) return link;
  const r = await sendStudentMessage(studentId, "topup", ({ locale, school, studentName }) =>
    topUpOfferMessage(locale, {
      school, studentName, hoursLeft: formatHours(Math.max(leftBefore, 0), locale), packageName: locale === "nl" ? pkg.nameNl : pkg.nameEn,
      price: formatMoney(pkg.priceCents, locale), payUrl: link.data.url,
    }),
  );
  return ok({ sent: r.sent, invoiceNumber: sold.data.number });
}
