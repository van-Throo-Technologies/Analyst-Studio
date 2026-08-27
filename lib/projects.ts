import "server-only";

import { prisma } from "./prisma";
import { verifySession } from "./dal";

// Every read scopes to the session's own user id — never to an id supplied by
// the caller — so there is no route through which one account can read
// another's projects, however the query is reached.
export async function getProjects() {
  const { userId } = await verifySession();

  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sourceDocuments: true, requirements: true } },
    },
  });
}

// Returns null rather than throwing when the project does not exist *or* is not
// this user's. Collapsing both cases into one answer means a wrong guess at an
// id cannot be used to discover that it belongs to someone else.
export async function getProject(id: string) {
  const { userId } = await verifySession();

  return prisma.project.findFirst({
    where: { id, userId },
    include: {
      sourceDocuments: {
        orderBy: { uploadedAt: "desc" },
        select: { id: true, filename: true, mimeType: true, uploadedAt: true },
      },
      requirements: { orderBy: { createdAt: "asc" } },
      findings: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export type ProjectListItem = Awaited<ReturnType<typeof getProjects>>[number];
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type RequirementRecord = ProjectDetail["requirements"][number];
