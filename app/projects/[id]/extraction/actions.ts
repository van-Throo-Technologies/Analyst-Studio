"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { AccessDeniedError, requireCapability } from "@/lib/auth/access";
import { encodeList } from "@/lib/db/mappers";
import { allocateRef } from "@/lib/db/refs";
import { AiJobError, AiNotConfiguredError } from "@/lib/ai/client";
import {
  extractOneSource,
  extractSources,
  UnvalidatedSourceError,
} from "@/lib/ai/jobs/extract-sources";
import { canExtractProject } from "@/lib/extraction/gate";
import { getProject, getSourceDocument } from "@/lib/db/queries";
import { recordTraceLink } from "@/lib/trace/links";
import { text, textList, type FormState } from "@/lib/forms";
import { analysisModeSchema, insightStatusSchema } from "@/lib/schemas/enums";
import type { EntityType, InsightType } from "@/lib/schemas/enums";

function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

export async function runExtractionAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let actor;
  try {
    actor = await requireCapability(projectId, "run_extraction");
  } catch (error) {
    if (error instanceof AccessDeniedError) return { ok: false, message: error.message };
    throw error;
  }

  const readiness = await canExtractProject(projectId);
  if (!readiness.canExtract) {
    return {
      ok: false,
      message: `Please validate all sources before extracting. ${readiness.blockers.join(" ")}`,
    };
  }

  const sourceIds = textList(formData, "sourceIds");
  const mode = analysisModeSchema.catch("BA").parse(text(formData, "mode"));

  if (sourceIds.length === 0) {
    return { ok: false, message: "Select at least one source to extract from." };
  }

  try {
    const result = await extractSources(projectId, sourceIds, mode, actor.user.id);
    revalidateProject(projectId);

    const summary =
      result.insightsCreated === 0
        ? `Extraction ran over ${result.sourcesProcessed} source${result.sourcesProcessed === 1 ? "" : "s"} but found nothing new to add.`
        : `Extracted ${result.insightsCreated} insight${result.insightsCreated === 1 ? "" : "s"} from ${result.sourcesProcessed} source${result.sourcesProcessed === 1 ? "" : "s"}.`;

    return { ok: true, message: summary };
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof AiJobError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof UnvalidatedSourceError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/**
 * Extraction for a single source.
 *
 * The spec's unit of work: one source, one call, one result. The batch runner
 * loops over this, and the insights screen uses it directly to re-read one
 * document without touching the rest of the project.
 */
export async function extractSourceAction(
  projectId: string,
  sourceDocumentId: string,
): Promise<
  FormState & {
    generationId?: string;
    insightCount?: number;
    findingCount?: number;
  }
> {
  let actor;
  try {
    actor = await requireCapability(projectId, "run_extraction");
  } catch (error) {
    if (error instanceof AccessDeniedError) return { ok: false, message: error.message };
    throw error;
  }

  const readiness = await canExtractProject(projectId);
  if (!readiness.canExtract) {
    return {
      ok: false,
      message: `Please validate all sources before extracting. ${readiness.blockers.join(" ")}`,
    };
  }

  const [project, source] = await Promise.all([
    getProject(projectId),
    getSourceDocument(sourceDocumentId),
  ]);

  if (!project) return { ok: false, message: "That project no longer exists." };
  if (!source || source.projectId !== projectId) {
    return { ok: false, message: "That source no longer exists." };
  }
  if (source.validationStatus !== "validated") {
    return {
      ok: false,
      message: `“${source.title}” has not been validated. Extraction only reads sources someone has confirmed are authoritative.`,
    };
  }

  try {
    const result = await extractOneSource(
      projectId,
      source,
      { project, mode: project.defaultMode },
      actor.user.id,
    );

    revalidateProject(projectId);

    return {
      ok: true,
      message: `Extracted ${result.insightCount} insight${result.insightCount === 1 ? "" : "s"} from “${source.title}”${result.findingCount > 0 ? `, with ${result.findingCount} quality finding${result.findingCount === 1 ? "" : "s"} to review` : ""}.`,
      generationId: result.generationId,
      insightCount: result.insightCount,
      findingCount: result.findingCount,
    };
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return { ok: false, message: error.message };
    if (error instanceof AiJobError) return { ok: false, message: error.message };
    if (error instanceof UnvalidatedSourceError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function updateInsightAction(
  projectId: string,
  insightId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const normalizedText = text(formData, "normalizedText").trim();
  if (normalizedText.length === 0) {
    return { ok: false, message: "Insight text cannot be empty." };
  }

  await prisma.extractedInsight.update({
    where: { id: insightId, projectId },
    // userEdited is what lets the quality view distinguish "the model said this"
    // from "a human stands behind this".
    data: { normalizedText, userEdited: true },
  });

  revalidateProject(projectId);
  return { ok: true, message: "Saved." };
}

export async function setInsightStatusAction(
  projectId: string,
  insightId: string,
  status: string,
): Promise<void> {
  const parsed = insightStatusSchema.safeParse(status);
  if (!parsed.success) return;

  await prisma.extractedInsight.update({
    where: { id: insightId, projectId },
    data: { status: parsed.data },
  });

  revalidateProject(projectId);
}

export async function deleteInsightAction(
  projectId: string,
  insightId: string,
): Promise<void> {
  await prisma.extractedInsight.delete({ where: { id: insightId, projectId } });
  revalidateProject(projectId);
}

export async function bulkInsightStatusAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = textList(formData, "insightIds");
  const parsed = insightStatusSchema.safeParse(text(formData, "status"));

  if (ids.length === 0) return { ok: false, message: "Nothing selected." };
  if (!parsed.success) return { ok: false, message: "Unknown status." };

  const result = await prisma.extractedInsight.updateMany({
    where: { id: { in: ids }, projectId, status: { not: "promoted" } },
    data: { status: parsed.data },
  });

  revalidateProject(projectId);
  return {
    ok: true,
    message: `${result.count} insight${result.count === 1 ? "" : "s"} marked ${parsed.data}.`,
  };
}

/**
 * Converts accepted insights into structured entities.
 *
 * Only five insight types become their own entity. Assumptions, constraints and
 * risks have no entity of their own in the canonical model — an accepted
 * insight of those types *is* the project's register for them, and the pack
 * builders read it directly. That keeps them traceable to a source document
 * without inventing a table whose only content would be one string.
 */
export async function promoteInsightsAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ids = textList(formData, "insightIds");
  if (ids.length === 0) return { ok: false, message: "Nothing selected." };

  const insights = await prisma.extractedInsight.findMany({
    where: { id: { in: ids }, projectId, status: { in: ["pending", "accepted"] } },
  });

  let promoted = 0;
  let acceptedOnly = 0;

  for (const insight of insights) {
    const result = await promoteOne(projectId, insight);
    if (result === "accepted") {
      acceptedOnly += 1;
      continue;
    }
    promoted += 1;
  }

  revalidateProject(projectId);

  const parts: string[] = [];
  if (promoted > 0) parts.push(`${promoted} promoted to structured entities`);
  if (acceptedOnly > 0) {
    parts.push(
      `${acceptedOnly} accepted into the assumption / constraint / risk register`,
    );
  }
  if (parts.length === 0) {
    return { ok: false, message: "Nothing to promote — those items are already promoted." };
  }
  return { ok: true, message: `${parts.join(", ")}.` };
}

/**
 * Stakeholders and actors arrive as a sentence, not a structured name. Take the
 * leading noun phrase as the name and keep the rest as the role. Deliberately
 * simple — the analyst edits it in the requirement model anyway.
 */
function splitNameAndRole(sentenceText: string): { name: string; role: string } {
  const bracket = sentenceText.match(/^([^(,–—-]{2,60}?)\s*[(,–—-]\s*(.+)$/);
  if (bracket) {
    return { name: bracket[1].trim(), role: bracket[2].replace(/\)$/, "").trim() };
  }
  const words = sentenceText.split(/\s+/);
  if (words.length <= 6) return { name: sentenceText.trim(), role: "" };
  return { name: words.slice(0, 5).join(" "), role: "" };
}

function firstSentence(value: string, max: number): string {
  const match = value.match(/^(.+?[.!?])(\s|$)/);
  const candidate = (match?.[1] ?? value).trim();
  return candidate.length <= max ? candidate : `${candidate.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Turns one insight into its structured entity.
 *
 * Shared by the bulk promote and the single-insight promote form, so the two
 * cannot drift on what a promoted stakeholder or requirement actually becomes.
 * `overrides` carry the analyst's edits from the prefilled form; without them
 * the insight's own text is used, which is the bulk path.
 *
 * Returns "accepted" for the three types that have no entity of their own —
 * assumptions, constraints and risks live as accepted insights.
 */
async function promoteOne(
  projectId: string,
  insight: { id: string; insightType: string; normalizedText: string; sourceDocumentId: string },
  overrides?: { title?: string; description?: string },
): Promise<"promoted" | "accepted"> {
  const type = insight.insightType as InsightType;
  const t = (overrides?.description ?? insight.normalizedText).trim();
  const heading = (overrides?.title ?? "").trim();
  const refs = encodeList([insight.sourceDocumentId]);

  let entityType: EntityType | null = null;
  let entityId: string | null = null;

  switch (type) {
    case "stakeholder": {
      const parsed = splitNameAndRole(t);
      const row = await prisma.stakeholder.create({
        data: {
          projectId,
          name: heading || parsed.name,
          role: parsed.role,
          notes: t,
          sourceRefsJson: refs,
        },
      });
      entityType = "stakeholder";
      entityId = row.id;
      break;
    }
    case "actor": {
      const parsed = splitNameAndRole(t);
      const row = await prisma.actor.create({
        data: {
          projectId,
          name: heading || parsed.name,
          description: t,
          sourceRefsJson: refs,
        },
      });
      entityType = "actor";
      entityId = row.id;
      break;
    }
    case "goal": {
      const row = await prisma.businessGoal.create({
        data: {
          projectId,
          title: heading || firstSentence(t, 120),
          description: t,
          sourceRefsJson: refs,
        },
      });
      entityType = "business_goal";
      entityId = row.id;
      break;
    }
    case "business_rule": {
      const row = await prisma.businessRule.create({
        data: { projectId, ruleText: heading || t, rationale: heading ? t : "", sourceRefsJson: refs },
      });
      entityType = "business_rule";
      entityId = row.id;
      break;
    }
    case "requirement_candidate": {
      const ref = await allocateRef("requirement", projectId);
      const row = await prisma.requirement.create({
        data: {
          projectId,
          ref,
          title: heading || firstSentence(t, 140),
          description: t,
          requirementType: "functional",
          priority: "medium",
          status: "draft",
          sourceRefsJson: refs,
        },
      });
      entityType = "requirement";
      entityId = row.id;
      break;
    }
    default:
      // assumption | constraint | risk — accepting is the promotion.
      await prisma.extractedInsight.update({
        where: { id: insight.id },
        data: { status: "accepted" },
      });
      return "accepted";
  }

  await prisma.extractedInsight.update({
    where: { id: insight.id },
    data: { status: "promoted", promotedToType: entityType, promotedToId: entityId },
  });

  await recordTraceLink({
    projectId,
    fromEntityType: "source_document",
    fromEntityId: insight.sourceDocumentId,
    toEntityType: entityType,
    toEntityId: entityId,
    linkReason: `Extracted as ${type.replace(/_/g, " ")} and promoted by the analyst`,
  });

  return "promoted";
}

/**
 * Promote one insight, with the analyst's edits from the prefilled form.
 *
 * The bulk path takes the model's wording as-is, which is right when clearing
 * twenty obvious stakeholders. This path exists for the ones worth thinking
 * about: the form opens with the insight's text already in it, and what gets
 * saved is what the analyst leaves there.
 */
export async function promoteInsightAction(
  projectId: string,
  insightId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await requireCapability(projectId, "run_extraction");
  } catch (error) {
    if (error instanceof AccessDeniedError) return { ok: false, message: error.message };
    throw error;
  }

  const insight = await prisma.extractedInsight.findUnique({
    where: { id: insightId, projectId },
  });
  if (!insight) return { ok: false, message: "That insight no longer exists." };
  if (insight.status === "promoted") {
    return { ok: false, message: "That insight has already been promoted." };
  }

  const description = text(formData, "description").trim();
  if (description.length === 0) {
    return { ok: false, message: "The description cannot be empty." };
  }

  const outcome = await promoteOne(projectId, insight, {
    title: text(formData, "title"),
    description,
  });

  revalidateProject(projectId);
  return {
    ok: true,
    message:
      outcome === "accepted"
        ? "Accepted into the project register."
        : "Promoted.",
  };
}
