/**
 * Backfills content checksums for sources added before checksums existed.
 *
 * The migration could give the new columns defaults but not compute a SHA-256
 * — SQLite has no hash function, and the normalisation rules live in
 * application code (lib/intake/checksum.ts). This does that pass.
 *
 * Duplicates are reported, not merged. Two sources with identical content are
 * a decision for an analyst — which one carries the better title, whether the
 * insights hanging off each still make sense — and not something a script gets
 * to make at 2am.
 *
 * Idempotent — only touches rows with no checksum.
 *
 * Run with: npm run db:backfill:checksums
 */

import { prisma } from "../lib/db/client";
import { contentChecksum, shortChecksum } from "../lib/intake/checksum";

async function main() {
  const rows = await prisma.sourceDocument.findMany({
    where: { checksumHash: null },
    select: { id: true, projectId: true, title: true, content: true },
  });

  if (rows.length === 0) {
    console.log("Every source already has a checksum. Nothing to do.");
    return;
  }

  for (const row of rows) {
    await prisma.sourceDocument.update({
      where: { id: row.id },
      data: { checksumHash: contentChecksum(row.content) },
    });
  }

  console.log(`Checksummed ${rows.length} source${rows.length === 1 ? "" : "s"}`);

  // Report duplicates across the whole table, not just the backfilled rows —
  // the point is to surface what was already there.
  const all = await prisma.sourceDocument.findMany({
    select: { id: true, projectId: true, title: true, checksumHash: true },
  });

  const byKey = new Map<string, { title: string }[]>();
  for (const row of all) {
    if (!row.checksumHash) continue;
    const key = `${row.projectId}:${row.checksumHash}`;
    byKey.set(key, [...(byKey.get(key) ?? []), { title: row.title }]);
  }

  const duplicates = [...byKey.entries()].filter(([, group]) => group.length > 1);

  if (duplicates.length === 0) {
    console.log("No duplicate content found.");
    return;
  }

  console.log(`\n${duplicates.length} set(s) of identical content:`);
  for (const [key, group] of duplicates) {
    console.log(`  ${shortChecksum(key.split(":")[1])} — ${group.map((g) => `“${g.title}”`).join(", ")}`);
  }
  console.log("\nNothing was merged. Decide per set which copy to keep.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
