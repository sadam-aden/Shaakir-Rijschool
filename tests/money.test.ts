import { describe, expect, it } from "vitest";
import {
  daysOverdue, deriveInvoiceStatus, invoiceNumber, invoiceTotals, lineFromGross, mollieAmount, netFromGross, nextReminderLevel, revenueByMonth,
} from "@/lib/domain/money";

describe("VAT and invoice totals", () => {
  it("derives net and VAT from a gross package price (21 %)", () => {
    expect(netFromGross(59500, 21)).toBe(49174); // 595,00 incl. VAT
    const t = invoiceTotals([lineFromGross("10 lessen", 59500, 21)]);
    expect(t).toMatchObject({ subtotalCents: 49174, vatCents: 10326, totalCents: 59500 }); // the total is exactly the price
  });
  it("keeps whole-euro prices exact where the maths allows", () => {
    const t = invoiceTotals([lineFromGross("Examen", 12100, 21)]);
    expect(t).toMatchObject({ subtotalCents: 10000, vatCents: 2100, totalCents: 12100 });
  });
  it("breaks VAT down per rate", () => {
    const t = invoiceTotals([lineFromGross("Les", 12100, 21), lineFromGross("Boek", 1090, 9)]);
    expect(t.vatBreakdown.map((b) => b.rate)).toEqual([9, 21]);
    expect(t.totalCents).toBe(12100 + 1090);
    expect(t.totalCents).toBe(t.subtotalCents + t.vatCents);
  });
  it("formats sequential invoice numbers", () => {
    expect(invoiceNumber(2026, 142)).toBe("2026-0142");
    expect(invoiceNumber(2026, 1)).toBe("2026-0001");
  });
  it("formats Mollie amounts", () => {
    expect(mollieAmount(59500)).toEqual({ currency: "EUR", value: "595.00" });
    expect(mollieAmount(5)).toEqual({ currency: "EUR", value: "0.05" });
  });
});

describe("invoice status", () => {
  const today = new Date("2026-10-09T12:00:00Z");
  const base = { status: "OPEN" as const, totalCents: 59500, paidCents: 0, dueDate: new Date("2026-10-20") };
  it("is open, partially paid or paid", () => {
    expect(deriveInvoiceStatus(base, today)).toBe("OPEN");
    expect(deriveInvoiceStatus({ ...base, paidCents: 30000 }, today)).toBe("PARTIALLY_PAID");
    expect(deriveInvoiceStatus({ ...base, paidCents: 59500 }, today)).toBe("PAID");
  });
  it("is overdue after the due date while something is owed, even when partially paid", () => {
    expect(deriveInvoiceStatus({ ...base, dueDate: new Date("2026-10-01") }, today)).toBe("OVERDUE");
    expect(deriveInvoiceStatus({ ...base, dueDate: new Date("2026-10-01"), paidCents: 30000 }, today)).toBe("OVERDUE");
    expect(deriveInvoiceStatus({ ...base, dueDate: new Date("2026-10-01"), paidCents: 59500 }, today)).toBe("PAID");
  });
  it("is not overdue on the due date itself", () => {
    expect(deriveInvoiceStatus({ ...base, dueDate: new Date("2026-10-09") }, today)).toBe("OPEN");
  });
  it("keeps void and draft invoices as they are", () => {
    expect(deriveInvoiceStatus({ ...base, status: "VOID", dueDate: new Date("2026-01-01") }, today)).toBe("VOID");
    expect(deriveInvoiceStatus({ ...base, status: "DRAFT" }, today)).toBe("DRAFT");
  });
  it("counts days overdue", () => {
    expect(daysOverdue(new Date("2026-09-30"), today)).toBe(9);
    expect(daysOverdue(new Date("2026-10-20"), today)).toBe(0);
  });
});

describe("payment reminders", () => {
  it("sends level 1 after 3 days and level 2 after 10 days overdue", () => {
    expect(nextReminderLevel(2, [])).toBeNull();
    expect(nextReminderLevel(3, [])).toBe(1);
    expect(nextReminderLevel(9, [1])).toBeNull();
    expect(nextReminderLevel(10, [1])).toBe(2);
  });
  it("never repeats a level and skips a missed first reminder", () => {
    expect(nextReminderLevel(12, [1, 2])).toBeNull();
    expect(nextReminderLevel(12, [])).toBe(2);
  });
});

describe("revenue per month", () => {
  const monthOf = (d: Date) => d.toISOString().slice(0, 7);
  it("zero-fills the last six months and ignores older payments", () => {
    const r = revenueByMonth(
      [{ paidAt: new Date("2026-10-02T10:00:00Z"), amountCents: 5000 }, { paidAt: new Date("2026-10-05T10:00:00Z"), amountCents: 2500 }, { paidAt: new Date("2026-08-15T10:00:00Z"), amountCents: 1000 }, { paidAt: new Date("2025-01-01T10:00:00Z"), amountCents: 9999 }],
      new Date("2026-10-09T00:00:00Z"), 6, monthOf,
    );
    expect(r.map((x) => x.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(r.find((x) => x.month === "2026-10")?.cents).toBe(7500);
    expect(r.find((x) => x.month === "2026-08")?.cents).toBe(1000);
    expect(r.find((x) => x.month === "2026-09")?.cents).toBe(0);
  });
  it("wraps over the year boundary", () => {
    const r = revenueByMonth([], new Date("2026-02-10T00:00:00Z"), 4, monthOf);
    expect(r.map((x) => x.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});
