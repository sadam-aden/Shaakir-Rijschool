import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/dal/session";
import { paidCentsOf, parseLines } from "@/lib/dal/invoices";
import { db } from "@/lib/db";
import { euros, toCsv } from "@/lib/domain/csv";
import { deriveInvoiceStatus, outstandingCents } from "@/lib/domain/money";
import { localDateKey } from "@/lib/domain/time";

/**
 * GET /api/export/accountant?year=2026  (admin only)
 * One line per invoice with net, VAT, total, paid and outstanding amounts, ready for the accountant.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const year = Number(req.nextUrl.searchParams.get("year")) || Number(localDateKey(new Date()).slice(0, 4));
  const invoices = await db.invoice.findMany({
    where: { schoolId: user.schoolId, issuedAt: { gte: new Date(Date.UTC(year, 0, 1) - 3_600_000), lt: new Date(Date.UTC(year + 1, 0, 1) - 3_600_000) } },
    include: { student: { select: { firstName: true, lastName: true } }, payments: true },
    orderBy: { number: "asc" },
  });
  const now = new Date();
  const rows = invoices.map((i) => {
    const paid = paidCentsOf(i.payments);
    return [
      i.number, localDateKey(i.issuedAt), localDateKey(i.dueDate), `${i.student.firstName} ${i.student.lastName}`, parseLines(i.lines).map((l) => l.description).join(" + "),
      euros(i.subtotalCents), euros(i.vatCents), euros(i.totalCents), euros(paid), euros(outstandingCents(i.totalCents, paid)),
      deriveInvoiceStatus({ status: i.status, totalCents: i.totalCents, paidCents: paid, dueDate: i.dueDate }, now),
    ];
  });
  const csv = toCsv(["Factuurnummer", "Factuurdatum", "Vervaldatum", "Leerling", "Omschrijving", "Excl. btw", "Btw", "Incl. btw", "Betaald", "Openstaand", "Status"], rows);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="facturen-${year}.csv"`, "Cache-Control": "no-store" },
  });
}
