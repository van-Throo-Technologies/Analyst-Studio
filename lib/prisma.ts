import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads modules in development, which would otherwise construct a
// new PrismaClient on every edit until the connection pool is exhausted. Caching
// the instance on globalThis keeps one client across reloads. In production the
// module is evaluated once, so the global is unnecessary and deliberately unset.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
