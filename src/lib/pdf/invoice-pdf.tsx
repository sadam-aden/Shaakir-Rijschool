import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { AppLocale } from "@/i18n/config";
import type { InvoiceLine, InvoiceTotals } from "@/lib/domain/money";
import { formatDateLong, formatMoney } from "@/lib/format";

export type InvoicePdfData = {
  locale: AppLocale;
  number: string;
  issuedAt: Date;
  dueDate: Date;
  paidCents: number;
  paymentTermDays: number;
  school: { name: string; address?: string | null; postcode?: string | null; city?: string | null; kvk?: string | null; btw?: string | null; iban?: string | null };
  customer: { name: string; address?: string | null; postcode?: string | null; city?: string | null; email?: string | null };
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  /** iDEAL link shown on open invoices */
  payUrl?: string | null;
  void?: boolean;
};

// Invoices are printed documents in the student's language (Dutch by default), so their words live here, not in the UI messages.
const L = {
  nl: {
    invoice: "Factuur", number: "Factuurnummer", date: "Factuurdatum", due: "Vervaldatum", billTo: "Factuur voor",
    description: "Omschrijving", qty: "Aantal", amount: "Bedrag (incl. btw)", subtotal: "Totaal excl. btw", vat: "Btw", total: "Totaal incl. btw",
    paid: "Reeds betaald", outstanding: "Nog te betalen", stamp: "BETAALD", voided: "VERVALLEN",
    payInstr: (days: number, iban: string) => `Betaal binnen ${days} dagen onder vermelding van het factuurnummer op ${iban}.`,
    payLink: "Of betaal direct met iDEAL:", kvk: "KvK", btw: "Btw-nr", iban: "IBAN", vatLine: (rate: number, net: string) => `${rate}% over ${net}`,
    thanks: "Bedankt voor je vertrouwen!",
  },
  en: {
    invoice: "Invoice", number: "Invoice number", date: "Invoice date", due: "Due date", billTo: "Billed to",
    description: "Description", qty: "Qty", amount: "Amount (incl. VAT)", subtotal: "Total excl. VAT", vat: "VAT", total: "Total incl. VAT",
    paid: "Already paid", outstanding: "Amount due", stamp: "PAID", voided: "VOID",
    payInstr: (days: number, iban: string) => `Please pay within ${days} days, quoting the invoice number, to ${iban}.`,
    payLink: "Or pay directly with iDEAL:", kvk: "KvK", btw: "VAT no.", iban: "IBAN", vatLine: (rate: number, net: string) => `${rate}% on ${net}`,
    thanks: "Thank you for your trust!",
  },
} as const;

const s = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  top: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1D4ED8" },
  muted: { color: "#64748B" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  box: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  label: { fontSize: 8, color: "#64748B", textTransform: "uppercase", marginBottom: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#CBD5E1", paddingBottom: 5, marginBottom: 5, color: "#64748B", fontSize: 8, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0" },
  c1: { flex: 6 }, c2: { flex: 1, textAlign: "right" }, c3: { flex: 2, textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: 250 },
  tr: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#0F172A", marginTop: 4, fontFamily: "Helvetica-Bold", fontSize: 12 },
  stamp: { position: "absolute", top: 210, right: 60, borderWidth: 3, borderColor: "#0F6B4B", color: "#0F6B4B", paddingHorizontal: 14, paddingVertical: 6, fontSize: 22, fontFamily: "Helvetica-Bold", transform: "rotate(-12deg)" },
  stampVoid: { borderColor: "#B91C1C", color: "#B91C1C" },
  foot: { position: "absolute", bottom: 30, left: 44, right: 44, textAlign: "center", color: "#64748B", fontSize: 8 },
});

const place = (a?: string | null, p?: string | null, c?: string | null) => [a, [p, c].filter(Boolean).join(" ")].filter(Boolean);

export function InvoiceDocument({ d }: { d: InvoicePdfData }) {
  const t = L[d.locale];
  const money = (c: number) => formatMoney(c, d.locale);
  const fullyPaid = d.paidCents >= d.totals.totalCents;
  const outstanding = Math.max(0, d.totals.totalCents - d.paidCents);

  return (
    <Document title={`${t.invoice} ${d.number}`} author={d.school.name}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View>
            <Text style={s.brand}>{d.school.name}</Text>
            {place(d.school.address, d.school.postcode, d.school.city).map((x, i) => <Text key={i} style={s.muted}>{x}</Text>)}
            {d.school.kvk ? <Text style={s.muted}>{t.kvk}: {d.school.kvk}</Text> : null}
            {d.school.btw ? <Text style={s.muted}>{t.btw}: {d.school.btw}</Text> : null}
            {d.school.iban ? <Text style={s.muted}>{t.iban}: {d.school.iban}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>{t.invoice}</Text>
            <Text style={[s.muted, { textAlign: "right", marginTop: 4 }]}>{t.number}: <Text style={s.bold}>{d.number}</Text></Text>
            <Text style={[s.muted, { textAlign: "right" }]}>{t.date}: {formatDateLong(d.issuedAt, d.locale)}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>{t.due}: {formatDateLong(d.dueDate, d.locale)}</Text>
          </View>
        </View>

        <View style={s.box}>
          <View>
            <Text style={s.label}>{t.billTo}</Text>
            <Text style={s.bold}>{d.customer.name}</Text>
            {place(d.customer.address, d.customer.postcode, d.customer.city).map((x, i) => <Text key={i}>{x}</Text>)}
            {d.customer.email ? <Text style={s.muted}>{d.customer.email}</Text> : null}
          </View>
        </View>

        <View style={s.th}>
          <Text style={s.c1}>{t.description}</Text>
          <Text style={s.c2}>{t.qty}</Text>
          <Text style={s.c3}>{t.amount}</Text>
        </View>
        {d.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.c1}>{l.description}</Text>
            <Text style={s.c2}>{l.quantity}</Text>
            <Text style={s.c3}>{money(l.unitGrossCents * l.quantity)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.tr}><Text style={s.muted}>{t.subtotal}</Text><Text>{money(d.totals.subtotalCents)}</Text></View>
          {d.totals.vatBreakdown.map((b) => (
            <View key={b.rate} style={s.tr}><Text style={s.muted}>{t.vat} {t.vatLine(b.rate, money(b.netCents))}</Text><Text>{money(b.vatCents)}</Text></View>
          ))}
          <View style={s.grand}><Text>{t.total}</Text><Text>{money(d.totals.totalCents)}</Text></View>
          {d.paidCents > 0 && <View style={s.tr}><Text style={s.muted}>{t.paid}</Text><Text>− {money(Math.min(d.paidCents, d.totals.totalCents))}</Text></View>}
          {d.paidCents > 0 && !fullyPaid && <View style={[s.tr, s.bold]}><Text>{t.outstanding}</Text><Text>{money(outstanding)}</Text></View>}
        </View>

        {!fullyPaid && !d.void && (
          <View style={{ marginTop: 28 }}>
            {d.school.iban ? <Text>{t.payInstr(d.paymentTermDays, d.school.iban)}</Text> : null}
            {d.payUrl ? <Text style={{ marginTop: 4 }}>{t.payLink} {d.payUrl}</Text> : null}
          </View>
        )}
        {(fullyPaid || d.void) && <Text style={[s.stamp, d.void ? s.stampVoid : {}]}>{d.void ? t.voided : t.stamp}</Text>}
        <Text style={s.foot}>{t.thanks} · {d.school.name}</Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(d: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument d={d} />);
}
