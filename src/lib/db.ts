import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaKey?: string };

/**
 * Fingerprint of the generated client (all model fields). In development the client is cached on `globalThis`
 * so hot reloads do not open new connections; when the schema changes (new column + `prisma generate`) the
 * fingerprint changes and a fresh client is created, so you never have to restart the dev server for that.
 */
const schemaKey = Object.entries(Prisma as unknown as Record<string, unknown>)
  .filter(([k, v]) => k.endsWith("ScalarFieldEnum") && v && typeof v === "object")
  .map(([k, v]) => `${k}:${Object.keys(v as object).join(",")}`)
  .join("|");

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

if (globalForPrisma.prisma && globalForPrisma.prismaSchemaKey !== schemaKey) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const db = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaSchemaKey = schemaKey;
}
