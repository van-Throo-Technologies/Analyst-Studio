import "server-only";
import { prisma } from "@/lib/db/client";
import { AI_EFFORT } from "@/lib/ai/client";
import { runStructuredJob } from "@/lib/ai/runner";
import { extractionOutputSchema } from "@/lib/ai/schemas";
import { extractionPrompt } from "@/lib/prompts/extraction";
import { getProject, listSourceDocuments } from "@/lib/db/queries";
import { ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION } from "@/lib/phase-scope";
import { runExtractionGates } from "@/lib/quality/extraction-gates";
import { recordProjectAudit } from "@/lib/audit/log";
import { truncate } from "@/lib/utils";
import type { SourceDocumentWithUploader } from "@/lib/schemas/entities";
import type { AnalysisMode } from "@/lib/schemas/enums";
import type { PromptContext } from "@/lib/prompts";

/**
 * Job 1 — run extraction over selected sources.
 *
 * Sources are extracted one at a time rather than in a single batch. It costs
 * more calls, but every insight then has an unambiguous parent source, which is
 * what the traceability view depends on. A batched run would force us to guess
 * which document a given insight came from.
 *
 * From Phase 3, only validated sources are read. The check lives here, at the
 * last point before material reaches the model, rather than in the action that
 * calls it — everything downstream of extraction (insights, entities, packs,
 * the traceability view) inherits its authority from the source, so a second
 * caller added later must not be able to route around it. It is currently
 * dormant: see ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION in lib/phase-scope.ts.
 */

/** Thrown when a caller asks to extract from material nobody has vouched for. */
export class UnvalidatedSourceError extends Error {
  readonly titles: string[];

  constructor(titles: string[]) {
    super(
      titles.length === 1
        ? `“${titles[0]}” has not been validated yet. Extraction only reads sources someone has confirmed are authoritative.`
        : `${titles.length} of the selected sources have not been validated: ${titles.map((t) => `“${t}”`).join(", ")}. Extraction only reads sources someone has confirmed are authoritative.`,
    );
    this.name = "UnvalidatedSourceError";
    this.titles = titles;
  }
}

export type ExtractionRunResult = {
  insightsCreated: number;
  findingsCreated: number;
  unresolved: string[];
  sourcesProcessed: number;
  generationIds: string[];
};

/** What one source's extraction produced. */
export type SingleSourceResult = {
  generationId: string;
  insightCount: number;
  findingCount: number;
  unresolved: string[];
};

export async function extractSources(
  projectId: string,
  sourceIds: string[],
  mode: AnalysisMode,
  userId: string | null = null,
): Promise<ExtractionRunResult> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const allSources = await listSourceDocuments(projectId);
  const selected = allSources.filter((s) => sourceIds.includes(s.id));
  if (selected.length === 0) {
    throw new Error("Select at least one source to extract from.");
  }

  // Rejected material is refused for the same reason as unvalidated material:
  // someone looked at it and said it is not a reliable record. Extracting from
  // it would launder that judgement into insights that look like every other.
  if (ENFORCE_VALIDATED_SOURCES_FOR_EXTRACTION) {
    const unvalidated = selected.filter((s) => s.validationStatus !== "validated");
    if (unvalidated.length > 0) {
      throw new UnvalidatedSourceError(unvalidated.map((s) => s.title));
    }
  }

  const context = { project, mode };
  const unresolved: string[] = [];
  const generationIds: string[] = [];
  let insightsCreated = 0;
  let findingsCreated = 0;

  // Sequential rather than concurrent: sources on one project overlap heavily,
  // and the duplicate gate can only see the insights already written. Running
  // them in parallel would make which duplicates get flagged depend on which
  // call returned first.
  for (const source of selected) {
    const result = await extractOneSource(projectId, source, context, userId);
    generationIds.push(result.generationId);
    unresolved.push(...result.unresolved);
    insightsCreated += result.insightCount;
    findingsCreated += result.findingCount;
  }

  return {
    insightsCreated,
    findingsCreated,
    unresolved,
    sourcesProcessed: selected.length,
    generationIds,
  };
}

/**
 * One source, one model call, one audit trail.
 *
 * Extraction is per-source rather than batched so every insight has an
 * unambiguous parent document. Everything written here — the generation record,
 * the insights, the findings, the audit entry — carries that source's id, so
 * "where did this come from" never needs inference.
 */
export async function extractOneSource(
  projectId: string,
  source: SourceDocumentWithUploader,
  context: PromptContext,
  userId: string | null,
): Promise<SingleSourceResult> {
  const { data, generationId } = await runStructuredJob({
    projectId,
    job: "source_extraction",
    prompt: extractionPrompt,
    context,
    input: {
      sources: [
        {
          title: source.title,
          sourceType: source.sourceType,
          provenance: source.sourceProvenance,
          sourceTimestamp: source.sourceTimestamp,
          content: source.content,
        },
      ],
    },
    schema: extractionOutputSchema,
    inputEntityIds: [source.id],
    effort: AI_EFFORT.extraction,
    // Long transcripts can yield a lot of insights; leave room rather than
    // risk a truncated structure that fails to parse.
    maxTokens: 16000,
  });

  // Everything already in the project, so the duplicate gate compares against
  // the whole model rather than only this source's own output.
  const existing = await prisma.extractedInsight.findMany({
    where: { projectId, sourceDocumentId: { not: source.id } },
    select: { normalizedText: true },
  });

  const findings = runExtractionGates({
    insights: data.insights,
    source,
    scenarioType: context.project.scenarioType,
    existingTexts: existing.map((row) => row.normalizedText),
  });

  // Re-running extraction on a source replaces its still-pending insights but
  // leaves anything the analyst already accepted, edited or dismissed alone.
  // Their review work is never thrown away by a re-run.
  const superseded = await prisma.extractedInsight.findMany({
    where: { sourceDocumentId: source.id, status: "pending" },
    select: { id: true },
  });
  const supersededIds = superseded.map((row) => row.id);

  await prisma.$transaction([
    prisma.extractedInsight.deleteMany({
      where: { id: { in: supersededIds } },
    }),
    // Findings from the previous run of *this* source go with the insights they
    // described. Scoped by job as well as by entity, so a quality review's
    // findings are never collateral damage.
    prisma.aiFinding.deleteMany({
      where: {
        projectId,
        job: "source_extraction",
        entityId: { in: [...supersededIds, source.id] },
      },
    }),
  ]);

  const created = await prisma.extractedInsight.createManyAndReturn({
    data: data.insights.map((insight) => ({
      projectId,
      sourceDocumentId: source.id,
      insightType: insight.insightType,
      rawText: insight.rawText.trim(),
      normalizedText: insight.normalizedText.trim(),
      confidence: clamp01(insight.confidence),
    })),
    select: { id: true },
  });

  if (findings.length > 0) {
    await prisma.aiFinding.createMany({
      data: findings.map((finding) => ({
        projectId,
        runId: generationId,
        job: "source_extraction",
        severity: finding.severity,
        entityType: finding.entityType,
        entityId:
          finding.insightIndex === null
            ? source.id
            : (created[finding.insightIndex]?.id ?? source.id),
        title: finding.title,
        explanation: finding.explanation,
        suggestedFix: finding.suggestedFix,
      })),
    });
  }

  await recordProjectAudit({
    projectId,
    userId,
    action: "source_extraction_completed",
    entityType: "source_document",
    entityId: source.id,
    changes: [
      { label: "insights", from: String(supersededIds.length), to: String(created.length) },
      { label: "findings", from: "", to: String(findings.length) },
    ],
    changesSummary: `Extracted ${created.length} insight${created.length === 1 ? "" : "s"} and ${findings.length} quality finding${findings.length === 1 ? "" : "s"} from “${truncate(source.title, 60)}”`,
  });

  return {
    generationId,
    insightCount: created.length,
    findingCount: findings.length,
    unresolved: data.unresolved,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 0), 1);
}
