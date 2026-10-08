import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "./session";

type Tx = Prisma.TransactionClient | typeof db;

export async function audit(
  tx: Tx, user: SessionUser, action: string, entity: string, entityId: string | null, data: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({ data: { schoolId: user.schoolId, userId: user.id, action, entity, entityId, data } });
}
