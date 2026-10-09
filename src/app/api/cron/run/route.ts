import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runAllJobs } from "@/lib/jobs/run";

export const maxDuration = 60;

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") return false; // never run unprotected
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Runs the background jobs: due 24 h lesson reminders, overdue invoices, payment reminders, ledger check.
 * Call it on a schedule with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends that header itself).
 * Every job is idempotent, so calling it more often than needed is harmless.
 */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runAllJobs());
}

export const POST = GET;
