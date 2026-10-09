import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;
/** Who did it: a signed-in user, or the system (jobs, webhooks) with id null. */
export type Actor = { id: string | null; schoolId: string };

export async function audit(
  tx: Tx, actor: Actor, action: string, entity: string, entityId: string | null, data: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({ data: { schoolId: actor.schoolId, userId: actor.id, action, entity, entityId, data } });
}
