import { describe, expect, it } from "vitest";
import { invoiceTotals, lineFromGross } from "@/lib/domain/money";
import { renderInvoicePdf, type InvoicePdfData } from "@/lib/pdf/invoice-pdf";

const lines = [lineFromGross("30 lessen + examen", 189000, 21)];
const data = (over: Partial<InvoicePdfData> = {}): InvoicePdfData => ({
  locale: "nl", number: "2026-0142", issuedAt: new Date("2026-10-01T10:00:00Z"), dueDate: new Date("2026-10-15T10:00:00Z"), paidCents: 0, paymentTermDays: 14,
  school: { name: "Shaakir Rijschool", city: "Rotterdam", kvk: "12345678", btw: "NL123456789B01", iban: "NL00BANK0123456789" },
  customer: { name: "Sanne Bakker", address: "Oostzeedijk 45", postcode: "3063 AB", city: "Rotterdam", email: "sanne@example.com" },
  lines, totals: invoiceTotals(lines), payUrl: "https://example.com/pay/x", ...over,
});

describe("invoice PDF", () => {
  it("renders a Dutch invoice as a real PDF file", async () => {
    const pdf = await renderInvoicePdf(data());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });
  it("renders English, paid and void variants", async () => {
    for (const over of [{ locale: "en" as const }, { paidCents: 189000 }, { void: true }]) {
      const pdf = await renderInvoicePdf(data(over));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
