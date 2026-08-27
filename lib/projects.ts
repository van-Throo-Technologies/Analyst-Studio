import "server-only";

import { prisma } from "./prisma";
import { verifySession } from "./dal";

// Reads always scope to the session's own user id — never to an id supplied by
// the caller — so there is no route through which one account can read another's
// projects, however the query is reached.
export async function getProjects() {
  const { userId } = await verifySession();

  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });
}
