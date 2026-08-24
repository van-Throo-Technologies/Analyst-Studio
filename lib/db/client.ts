import path from "node:path";
import { PrismaClient } from "@prisma/client";

function createClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  // Local SQLite development: use better-sqlite3 adapter
  if (dbUrl?.startsWith("file:")) {
    // Only import SQLite adapter for local development
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const raw = dbUrl.slice("file:".length);
    const dbPath =
      raw === ":memory:" || path.isAbsolute(raw)
        ? raw
        : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    return new PrismaClient({ adapter });
  }

  // Production PostgreSQL (or other database): use default Prisma client
  return new PrismaClient();
}

// Next.js dev mode re-evaluates modules on every hot reload; cache the client on
// globalThis so we do not open a new SQLite handle per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
