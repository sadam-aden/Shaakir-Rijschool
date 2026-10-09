import { NextResponse, type NextRequest } from "next/server";
import { syncPayment } from "@/lib/dal/invoices";
import { db } from "@/lib/db";

/**
 * Mollie calls this with `id=tr_…` whenever a payment changes. The body is never trusted for the status:
 * we re-fetch the payment from Mollie and apply that result (idempotent, so repeated calls are harmless).
 * Always answers 200 for unknown ids so ids cannot be probed.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") ?? "");
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ ok: true });
  const payment = await db.payment.findUnique({ where: { molliePaymentId: id }, select: { id: true } });
  if (!payment) return NextResponse.json({ ok: true });
  try {
    await syncPayment(payment.id);
  } catch (e) {
    console.error("[mollie webhook]", e);
    return NextResponse.json({ error: "sync failed" }, { status: 500 }); // Mollie retries on non-2xx
  }
  return NextResponse.json({ ok: true });
}
