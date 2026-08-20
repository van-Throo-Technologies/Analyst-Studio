import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * DATABASE_URL is written the Prisma way (`file:./prisma/dev.db`), but
 * better-sqlite3 opens a plain filesystem path. Resolve it against the project
 * root rather than the process cwd — Next.js server code can run from `.next`,
 * and a relative path would otherwise create a stray second database file.
 */
function databasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const raw = url.startsWith("file:") ? url.slice("file:".length) : url;
  if (raw === ":memory:" || path.isAbsolute(raw)) return raw;
  // turbopackIgnore: the bundler would otherwise trace the whole project as a
  // filesystem dependency. This path is opened at runtime, never bundled.
  return path.join(/* turbopackIgnore: true */ process.cwd(), raw);
}

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databasePath() });
  return new PrismaClient({ adapter });
}

// Next.js dev mode re-evaluates modules on every hot reload; cache the client on
// globalThis so we do not open a new SQLite handle per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
