import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/dal/session";
import { buildInvoicePdf } from "@/lib/dal/money-flow";

/** GET /api/invoices/:id/pdf — the invoice as a PDF in the student's language (admin only). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const pdf = await buildInvoicePdf(id, user.schoolId);
  if (!pdf) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pdf.filename}"`, "Cache-Control": "private, no-store" },
  });
}
