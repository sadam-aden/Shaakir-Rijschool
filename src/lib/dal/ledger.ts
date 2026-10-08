import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { summarize, type LedgerLine } from "@/lib/domain/ledger";

type Tx = Prisma.TransactionClient;

/** Appends ledger lines for a student/lesson and refreshes the cached balances — call inside a transaction. */
export async function appendLedger(
  tx: Tx,
  p: { schoolId: string; studentId: string; lessonId?: string | null; studentPackageId?: string | null; createdById?: string | null; note?: string },
  lines: LedgerLine[],
) {
  if (lines.length) {
    await tx.hoursLedgerEntry.createMany({
      data: lines.map((l) => ({
        schoolId: p.schoolId, studentId: p.studentId, lessonId: p.lessonId ?? null,
        studentPackageId: p.studentPackageId ?? null, type: l.type, minutes: l.minutes,
        note: p.note, createdById: p.createdById ?? null,
      })),
    });
  }
  await refreshStudentCache(tx, p.studentId);
}

/** Recomputes the cached balances from the append-only ledger (same transaction as the ledger write). */
export async function refreshStudentCache(tx: Pick<Tx, "hoursLedgerEntry" | "student">, studentId: string) {
  const entries = await tx.hoursLedgerEntry.findMany({ where: { studentId }, select: { type: true, minutes: true } });
  const { remaining, reserved } = summarize(entries);
  await tx.student.update({ where: { id: studentId }, data: { minutesRemaining: remaining, minutesReserved: reserved } });
}
