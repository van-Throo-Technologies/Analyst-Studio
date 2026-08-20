import "server-only";
import { prisma } from "@/lib/db/client";
import { ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION } from "@/lib/phase-scope";

/**
 * Whether a project's material is ready to be read by the model.
 *
 * The rule is all-or-nothing on purpose. Extracting from the validated half of
 * a project produces a requirement model that looks complete and is not, and
 * nothing downstream carries the caveat — a pack generated from it reads
 * exactly like one generated from fully vouched-for material. Blocking until
 * the whole set is decided keeps "what did we build this on" answerable.
 *
 * A rejected source blocks as surely as a pending one. Rejecting is a decision
 * about the material, not a way to file it away; if the project genuinely
 * should proceed without it, delete it and say so in the audit log.
 */

export type ExtractionReadiness = {
  canExtract: boolean;
  totalCount: number;
  validatedCount: number;
  pendingCount: number;
  rejectedCount: number;
  /** Ready-to-render explanation of what is standing in the way, if anything. */
  blockers: string[];
};

export async function canExtractProject(
  projectId: string,
): Promise<ExtractionReadiness> {
  const grouped = await prisma.sourceDocument.groupBy({
    by: ["validationStatus"],
    where: { projectId },
    _count: { _all: true },
  });

  const countOf = (status: string) =>
    grouped.find((row) => row.validationStatus === status)?._count._all ?? 0;

  const validatedCount = countOf("validated");
  const pendingCount = countOf("pending");
  const rejectedCount = countOf("rejected");
  const totalCount = validatedCount + pendingCount + rejectedCount;

  const blockers: string[] = [];
  if (totalCount === 0) {
    blockers.push("There are no sources to extract from yet.");
  }
  if (pendingCount > 0) {
    blockers.push(
      `${pendingCount} source${pendingCount === 1 ? " is" : "s are"} still waiting to be validated.`,
    );
  }
  if (rejectedCount > 0) {
    blockers.push(
      `${rejectedCount} source${rejectedCount === 1 ? " was" : "s were"} rejected. Remove ${rejectedCount === 1 ? "it" : "them"} or revisit the decision — extraction will not read material someone found unreliable.`,
    );
  }

  // With enforcement off (Phase 2 behaviour) the counts are still reported, so
  // the screen can show readiness honestly while nothing is actually blocked.
  const canExtract = ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION
    ? totalCount > 0 && pendingCount === 0 && rejectedCount === 0
    : totalCount > 0;

  return {
    canExtract,
    totalCount,
    validatedCount,
    pendingCount,
    rejectedCount,
    blockers,
  };
}
