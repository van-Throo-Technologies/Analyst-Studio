/**
 * Development users, and access for any project that predates multi-user.
 *
 * Six people, one per role, so the access model can actually be exercised:
 * switching to Rachel (REVIEWER) must make every edit control refuse, and
 * switching to Nadia (no access at all) must make the project vanish from her
 * list and 404 by URL. Without that, "access control enforced" is a claim
 * nobody can check.
 *
 * Idempotent — safe to run repeatedly.
 *
 * Run with: npm run db:seed:users
 */

import { prisma } from "../lib/db/client";
import { displayName } from "../lib/auth/display-name";
import { recordProjectAudit, SYSTEM_ACTOR } from "../lib/audit/log";
import type { ProjectRole } from "../lib/schemas/enums";

const PEOPLE: { email: string; name: string; role: ProjectRole | null }[] = [
  { email: "janine@analyststudio.dev", name: "Janine van Throo", role: "OWNER" },
  { email: "marieke@analyststudio.dev", name: "Marieke de Vries", role: "PM" },
  { email: "tom@analyststudio.dev", name: "Tom Bakker", role: "BA" },
  { email: "iris@analyststudio.dev", name: "Iris Janssen", role: "FA" },
  { email: "priya@analyststudio.dev", name: "Priya Nair", role: "ARCHITECT" },
  { email: "rachel@analyststudio.dev", name: "Rachel Osei", role: "REVIEWER" },
  // Deliberately has no access to anything. Switch to her to see the access
  // control working from the outside.
  { email: "nadia@analyststudio.dev", name: "Nadia Haddad", role: null },
];

async function main() {
  const users = new Map<
    string,
    { id: string; name: string | null; email: string }
  >();

  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: { email: person.email, name: person.name },
      update: { name: person.name },
    });
    users.set(person.email, user);
  }

  console.log(`${users.size} users present.`);

  const projects = await prisma.project.findMany({
    include: { _count: { select: { access: true } } },
  });

  let granted = 0;

  for (const project of projects) {
    // A project created before multi-user has no access rows and no owner.
    // Give it the full cast so every role is represented somewhere.
    for (const person of PEOPLE) {
      if (!person.role) continue;
      const user = users.get(person.email)!;

      const existing = await prisma.projectAccess.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      });
      if (existing) continue;

      await prisma.projectAccess.create({
        data: { projectId: project.id, userId: user.id, role: person.role },
      });
      await recordProjectAudit({
        projectId: project.id,
        action: "access_granted",
        entityType: "project_access",
        entityId: user.id,
        changesSummary: `${displayName(user)} added as ${person.role} by the multi-user retrofit`,
        changedBy: "migration",
      });
      granted += 1;
    }

    if (!project.ownerId) {
      const owner = users.get("janine@analyststudio.dev")!;
      await prisma.project.update({
        where: { id: project.id },
        data: { ownerId: owner.id },
      });
      console.log(`  Set owner of "${project.name}" to ${displayName(owner)}.`);
    }
  }

  // Sources that predate uploader tracking are attributed to the owner, marked
  // as such in the audit log rather than silently backdated.
  const unattributed = await prisma.sourceDocument.count({
    where: { uploadedByUserId: null },
  });

  if (unattributed > 0) {
    const owner = users.get("janine@analyststudio.dev")!;
    await prisma.sourceDocument.updateMany({
      where: { uploadedByUserId: null },
      data: { uploadedByUserId: owner.id, uploaderRole: "OWNER" },
    });
    for (const project of projects) {
      await recordProjectAudit({
        projectId: project.id,
        action: "source_updated",
        entityType: "source_document",
        changesSummary: `${unattributed} source${unattributed === 1 ? "" : "s"} predating uploader tracking attributed to ${displayName(owner)}`,
        changedBy: SYSTEM_ACTOR,
      });
    }
    console.log(`  Attributed ${unattributed} pre-existing source(s) to ${displayName(owner)}.`);
  }

  console.log(`${granted} access grant(s) created across ${projects.length} project(s).`);
  console.log("Switch users with the picker in the top-right of the app.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
