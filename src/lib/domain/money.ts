/**
 * Money rules (pure). Amounts are integer cents. Package prices include VAT (default 21 %), so the net
 * amount and the VAT are derived from the gross price and the invoice total equals the price exactly. Invoice numbers are sequential per year: 2026-0142.
 */
/** Lines carry the GROSS price (what the student pays, incl. VAT); net and VAT are derived so the total is always exact. */
export type InvoiceLine = { description: string; quantity: number; unitGrossCents: number; vatRate: number };

/** Net (excl. VAT) part of a gross amount, rounded to whole cents. */
export const netFromGross = (grossCents: number, vatRate: number) => Math.round((grossCents * 100) / (100 + vatRate));

export const lineFromGross = (description: string, unitGrossCents: number, vatRate: number, quantity = 1): InvoiceLine => ({
  description, quantity, unitGrossCents, vatRate,
});

export type InvoiceTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  /** VAT per rate, for the VAT breakdown on the invoice */
  vatBreakdown: { rate: number; netCents: number; vatCents: number; grossCents: number }[];
};

/** total = sum of gross amounts (never off by a cent); VAT = gross − net per rate. */
export function invoiceTotals(lines: InvoiceLine[]): InvoiceTotals {
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.vatRate, (byRate.get(l.vatRate) ?? 0) + l.unitGrossCents * l.quantity);
  const vatBreakdown = [...byRate.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([rate, grossCents]) => {
      const netCents = netFromGross(grossCents, rate);
      return { rate, netCents, vatCents: grossCents - netCents, grossCents };
    });
  return {
    subtotalCents: vatBreakdown.reduce((x, y) => x + y.netCents, 0),
    vatCents: vatBreakdown.reduce((x, y) => x + y.vatCents, 0),
    totalCents: vatBreakdown.reduce((x, y) => x + y.grossCents, 0),
    vatBreakdown,
  };
}

/** "2026-0142" */
export const invoiceNumber = (year: number, seq: number) => `${year}-${String(seq).padStart(4, "0")}`;

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export type InvoiceStatus = "DRAFT" | "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";

/**
 * Status from the facts: VOID and DRAFT are explicit; otherwise paid vs total decides, and an invoice that is
 * past its due date with something still owed is OVERDUE (also when partially paid, as in the mockup).
 */
export function deriveInvoiceStatus(i: { status: InvoiceStatus; totalCents: number; paidCents: number; dueDate: Date }, today: Date): InvoiceStatus {
  if (i.status === "VOID" || i.status === "DRAFT") return i.status;
  if (i.paidCents >= i.totalCents) return "PAID";
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (startOfDay(i.dueDate) < startOfDay(today)) return "OVERDUE";
  return i.paidCents > 0 ? "PARTIALLY_PAID" : "OPEN";
}

/** Whole days an invoice is past its due date (0 when not overdue). */
export function daysOverdue(dueDate: Date, today: Date) {
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.round((startOfDay(today) - startOfDay(dueDate)) / 86_400_000));
}

export const outstandingCents = (totalCents: number, paidCents: number) => Math.max(0, totalCents - paidCents);

/**
 * Which payment reminder is due? Reminders go out after `thresholds` days overdue (default 3 and 10).
 * `sentLevels` are the levels already sent; returns the next level to send, or null.
 */
export function nextReminderLevel(overdueDays: number, sentLevels: number[], thresholds: number[] = [3, 10]): number | null {
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (overdueDays >= thresholds[i]) {
      const level = i + 1;
      return sentLevels.includes(level) ? null : level;
    }
  }
  return null;
}

/** Mollie wants "595.00" (string, dot, two decimals). */
export const mollieAmount = (cents: number) => ({ currency: "EUR", value: (cents / 100).toFixed(2) });

/** Revenue per calendar month (UTC keys 'YYYY-MM') for the last `months` months, oldest first, zero-filled. */
export function revenueByMonth(payments: { paidAt: Date; amountCents: number }[], now: Date, months = 6, monthOf: (d: Date) => string) {
  const keys: string[] = [];
  const base = monthOf(now);
  let [y, m] = base.split("-").map(Number);
  for (let i = 0; i < months; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const p of payments) {
    const k = monthOf(p.paidAt);
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + p.amountCents);
  }
  return keys.map((month) => ({ month, cents: sums.get(month) ?? 0 }));
}
