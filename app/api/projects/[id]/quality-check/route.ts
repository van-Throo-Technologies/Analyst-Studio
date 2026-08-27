import { prisma } from "../../../../../lib/prisma";
import { verifySession } from "../../../../../lib/dal";
import { runAllChecks } from "../../../../../lib/quality-checker";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await verifySession();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: { requirements: { orderBy: { createdAt: "asc" } } },
  });
  if (!project) {
    return Response.json({ error: "That project could not be found." }, { status: 404 });
  }

  // The checks are deterministic and cheap, so this is computed on demand
  // rather than stored — a report can never be stale relative to its edits.
  return Response.json(runAllChecks(project.requirements));
}
