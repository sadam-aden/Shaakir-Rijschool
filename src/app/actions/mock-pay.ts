"use server";

import { notFound, redirect } from "next/navigation";
import { applyPaymentStatus } from "@/lib/dal/invoices";
import { db } from "@/lib/db";

/** Mock iDEAL outcome. Disabled as soon as a real Mollie key exists, and only for mock payments. */
export async function mockPayAction(paymentId: string, outcome: "paid" | "failed") {
  if (process.env.MOLLIE_API_KEY) notFound();
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { id: true, molliePaymentId: true } });
  if (!payment?.molliePaymentId?.startsWith("mock_")) notFound();
  await applyPaymentStatus(payment.id, outcome === "paid" ? "PAID" : "FAILED", new Date());
  redirect(`/pay/return?payment=${payment.id}`);
}
