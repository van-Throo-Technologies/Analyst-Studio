/**
 * Backfills domain profiles for projects created before the domain-context
 * retrofit.
 *
 * The migration gave those rows sensible column defaults (industry "other",
 * sensitivity "low") but could not create the DomainProfile records, since
 * those are written by application code. This does that, and records an audit
 * entry so the log does not silently begin mid-life.
 *
 * Idempotent — safe to run more than once.
 *
 * Run with: npm run db:backfill
 */

import { prisma } from "../lib/db/client";
import { toProject } from "../lib/db/mappers";
import { generateDomainProfile } from "../lib/domain/profile";
import { recordProjectAudit } from "../lib/audit/log";

async function main() {
  const projects = await prisma.project.findMany({
    include: { domainProfile: true, auditLogs: { take: 1 } },
  });

  let profilesCreated = 0;
  let auditSeeded = 0;

  for (const row of projects) {
    const project = toProject(row);

    if (!row.domainProfile) {
      await generateDomainProfile(project.id, {
        industry: project.industry,
        subdomain: project.subdomain,
        jurisdiction: project.jurisdiction,
        regulatorySensitivity: project.regulatorySensitivity,
        solutionDomain: project.solutionDomain,
      });
      profilesCreated += 1;
    }

    if (row.auditLogs.length === 0) {
      await recordProjectAudit({
        projectId: project.id,
        action: "created",
        changedBy: "migration",
        changesSummary:
          "Existing project brought forward by the domain-context retrofit. Changes before this point were not recorded.",
      });
      auditSeeded += 1;
    }
  }

  console.log(`Checked ${projects.length} project(s).`);
  console.log(`  ${profilesCreated} domain profile(s) created`);
  console.log(`  ${auditSeeded} audit trail(s) seeded`);
  if (profilesCreated === 0 && auditSeeded === 0) {
    console.log("  Nothing to do — everything was already in place.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
