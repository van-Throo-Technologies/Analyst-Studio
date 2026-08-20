import "server-only";
import { prisma } from "@/lib/db/client";
import type { EntityType } from "@/lib/schemas/enums";

/**
 * Trace links.
 *
 * Most lineage in Analyst Studio is implicit in foreign keys and sourceRefs:
 * an acceptance criterion knows its requirement, a requirement knows its
 * sources. TraceLink exists for the edges that have no natural column — an
 * insight that became a stakeholder, a pack section that drew on a set of
 * entities, a rule that informed a use case.
 *
 * The traceability view reads both: FK-derived edges and these explicit ones.
 */

export type LinkInput = {
  projectId: string;
  fromEntityType: EntityType;
  fromEntityId: string;
  toEntityType: EntityType;
  toEntityId: string;
  linkReason: string;
};

/** Idempotent — the unique index on the five identity columns absorbs repeats. */
export async function recordTraceLink(link: LinkInput): Promise<void> {
  await prisma.traceLink.upsert({
    where: {
      projectId_fromEntityType_fromEntityId_toEntityType_toEntityId: {
        projectId: link.projectId,
        fromEntityType: link.fromEntityType,
        fromEntityId: link.fromEntityId,
        toEntityType: link.toEntityType,
        toEntityId: link.toEntityId,
      },
    },
    create: link,
    update: { linkReason: link.linkReason },
  });
}

export async function recordTraceLinks(links: LinkInput[]): Promise<void> {
  for (const link of links) {
    await recordTraceLink(link);
  }
}

export async function removeTraceLinksFor(
  projectId: string,
  entityId: string,
): Promise<void> {
  await prisma.traceLink.deleteMany({
    where: {
      projectId,
      OR: [{ fromEntityId: entityId }, { toEntityId: entityId }],
    },
  });
}
