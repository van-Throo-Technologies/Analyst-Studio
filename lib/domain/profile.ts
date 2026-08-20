import "server-only";
import { prisma } from "@/lib/db/client";
import { toDomainProfile } from "@/lib/db/mappers";
import type { DomainProfile } from "@/lib/schemas/entities";
import {
  INDUSTRY_LABELS,
  JURISDICTION_LABELS,
  REGULATORY_SENSITIVITY_LABELS,
  type Industry,
  type Jurisdiction,
  type RegulatorySensitivity,
} from "@/lib/schemas/enums";

/**
 * The domain profile.
 *
 * A derived, denormalised view of a project's domain context, regenerated
 * whenever those fields change. It is deliberately a *projection*, never a
 * second source of truth — if the two ever disagree, the Project row wins and
 * regenerating fixes it.
 *
 * Why it exists as its own row rather than being computed on read: from Phase 3
 * the four list fields carry domain knowledge that shapes extraction prompts and
 * quality checks, and that knowledge has to be inspectable, editable and stable
 * across a run. A value recomputed on every read could change underneath an
 * in-flight AI job.
 *
 * In this phase the lists are intentionally empty and `promptContextSummary` is
 * composed deterministically from the structured fields. No AI is involved.
 * TODO(roadmap): Phase 3 populates terminology, risk areas, requirement themes
 * and compliance concerns from a curated per-industry knowledge base.
 */

export type DomainProfileInput = {
  industry: Industry;
  subdomain: string | null;
  jurisdiction: Jurisdiction | null;
  regulatorySensitivity: RegulatorySensitivity;
  solutionDomain: string | null;
};

/**
 * The one-line form prefixed to AI prompts from Phase 3 onward.
 *
 * Only answered fields appear — padding it with "not specified" would spend
 * tokens telling the model nothing and, worse, imply the analyst considered
 * and rejected something they simply skipped.
 */
export function buildPromptContextSummary(input: DomainProfileInput): string {
  const parts: string[] = [INDUSTRY_LABELS[input.industry]];

  if (input.subdomain) parts.push(input.subdomain);
  if (input.jurisdiction) parts.push(JURISDICTION_LABELS[input.jurisdiction]);

  parts.push(
    `${REGULATORY_SENSITIVITY_LABELS[input.regulatorySensitivity]} regulatory sensitivity`,
  );

  if (input.solutionDomain) parts.push(input.solutionDomain);

  return parts.join(" · ");
}

/**
 * Creates or refreshes the profile for a project. Idempotent: calling it twice
 * with the same input leaves the same row, so it is safe to call from both
 * create and update without checking which applies.
 */
export async function generateDomainProfile(
  projectId: string,
  input: DomainProfileInput,
): Promise<DomainProfile> {
  const fields = {
    industry: input.industry,
    subdomain: input.subdomain,
    jurisdiction: input.jurisdiction,
    regulatorySensitivity: input.regulatorySensitivity,
    solutionDomain: input.solutionDomain,
    promptContextSummary: buildPromptContextSummary(input),
  };

  const row = await prisma.domainProfile.upsert({
    where: { projectId },
    // The list columns are only set on create, so anything Phase 3 writes into
    // them survives a later settings change.
    create: {
      projectId,
      ...fields,
      terminologyHintsJson: "[]",
      likelyRiskAreasJson: "[]",
      likelyRequirementThemesJson: "[]",
      likelyComplianceConcernsJson: "[]",
    },
    update: fields,
  });

  return toDomainProfile(row);
}

export async function getDomainProfile(
  projectId: string,
): Promise<DomainProfile | null> {
  const row = await prisma.domainProfile.findUnique({ where: { projectId } });
  return row ? toDomainProfile(row) : null;
}
