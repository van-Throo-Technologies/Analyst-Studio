import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton for database access.
 *
 * Next.js dev mode re-evaluates modules on every hot reload; cache the client
 * on globalThis so we do not open a new database connection per reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
