import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { prisma } from "./prisma";
import { REQUIREMENT_TYPES, PRIORITIES } from "./constants";
import {
  getClient,
  ExtractionSchema,
  EXTRACTION_SYSTEM,
  ExtractionError,
  type ExtractedRequirement,
} from "./extract-core";
import { verifyEvidence } from "./grounding";
import { runAllChecks, type CheckableRequirement } from "./quality-checker";
import { repairRequirements, findCoverageGaps, findDomainGaps } from "./review";

export { REQUIREMENT_TYPES, PRIORITIES, ExtractionError };
export type { ExtractedRequirement };

// The extraction pipeline.
//
// One model pass produces requirements; the passes after it try to break them.
// Nothing is written until the whole run finishes, so a half-repaired set never
// reaches the reader.

export type PipelineStage =
  | "extract"
  | "ground"
  | "repair"
  | "coverage"
  | "expectations"
  | "save";

export type PipelineEvent =
  | { type: "stage"; stage: PipelineStage; label: string }
  | { type: "progress"; found: number };

type Document = { id?: string; filename: string; content: string };

function buildMaterial(documents: Document[]) {
  return documents
    .map((doc) => `<document filename="${doc.filename}">\n${doc.content}\n</document>`)
    .join("\n\n");
}

// Quality checks read the persisted shape; extraction produces the model shape.
// This maps one to the other so the same checks run before saving as after.
function toCheckable(requirements: ExtractedRequirement[]): CheckableRequirement[] {
  return requirements.map((r, index) => ({
    id: String(index),
    title: r.title,
    description: r.description,
    type: r.type,
    priority: r.priority,
    actor: r.actor,
    trigger: r.trigger,
    happyPath: r.happyPath,
    alternateFlows: r.alternateFlows.join("\n") || null,
    bdDAC: r.bddAcceptanceCriteria.join("\n") || null,
    checklistAC: r.checklistAcceptanceCriteria.join("\n") || null,
    completionScore: r.completionScore,
    validationGates: r.validationGates.join("\n") || null,
  }));
}

async function callExtraction(
  material: string,
  onProgress?: (found: number) => void,
): Promise<ExtractedRequirement[]> {
  const stream = getClient().messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the requirements from the following discovery material.\n\n${material}`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  if (onProgress) {
    let reported = 0;
    let buffer = "";

    // The output is one JSON document arriving in fragments. Each requirement
    // opens with its "title" key, so counting those keys counts completed-enough
    // objects without parsing partial JSON.
    stream.on("text", (delta) => {
      buffer += delta;
      const found = (buffer.match(/"title"\s*:/g) ?? []).length;
      if (found > reported) {
        reported = found;
        onProgress(found);
      }
    });
  }

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("The model declined to process this material.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return ExtractionSchema.parse(JSON.parse(text)).requirements;
  } catch {
    throw new ExtractionError(
      message.stop_reason === "max_tokens"
        ? "The material produced more requirements than fit in one response. Split it across two projects and try again."
        : "The model returned a response that did not match the expected shape.",
    );
  }
}

export type PipelineResult = {
  requirements: ExtractedRequirement[];
  grounding: Map<number, { verified: string[]; isGrounded: boolean }>;
  coverageScore: number;
  coverageGaps: Awaited<ReturnType<typeof findCoverageGaps>>["gaps"];
  domain: string;
  domainGaps: Awaited<ReturnType<typeof findDomainGaps>>["gaps"];
  repaired: number;
};

export async function runPipeline(
  documents: Document[],
  onEvent?: (event: PipelineEvent) => void,
): Promise<PipelineResult> {
  const emit = (event: PipelineEvent) => onEvent?.(event);
  const material = buildMaterial(documents);

  emit({ type: "stage", stage: "extract", label: "Reading the material" });
  let requirements = await callExtraction(material, (found) =>
    emit({ type: "progress", found }),
  );

  // --- repair -------------------------------------------------------------
  // The deterministic checks run here, before anything is written, so they act
  // as a gate rather than a report. Vagueness the source can settle is fixed;
  // vagueness the source cannot settle becomes an open question in the output.
  emit({ type: "stage", stage: "repair", label: "Resolving ambiguity against the source" });
  const issues = runAllChecks(toCheckable(requirements)).issues;
  let repaired = 0;
  if (issues.length > 0) {
    const revised = await repairRequirements(requirements, material, issues);
    // A repair pass that comes back with a different requirement count has done
    // something other than repair, so the original set is kept.
    if (revised.length === requirements.length) {
      repaired = issues.length;
      requirements = revised;
    }
  }

  // --- grounding ----------------------------------------------------------
  // Run after repair, because repair rewrites requirements and may move their
  // quotes. Purely deterministic: string matching, no model involved.
  emit({ type: "stage", stage: "ground", label: "Checking every quote against the source" });
  const grounding = new Map<number, { verified: string[]; isGrounded: boolean }>();
  requirements.forEach((requirement, index) => {
    const result = verifyEvidence(requirement.evidence, material);
    grounding.set(index, { verified: result.verified, isGrounded: result.isGrounded });
  });

  // --- coverage -----------------------------------------------------------
  emit({ type: "stage", stage: "coverage", label: "Looking for what was missed" });
  const coverage = await findCoverageGaps(requirements, material);

  // --- domain expectations ------------------------------------------------
  emit({ type: "stage", stage: "expectations", label: "Checking against what this kind of system needs" });
  const domain = await findDomainGaps(requirements);

  emit({ type: "stage", stage: "save", label: "Saving" });

  return {
    requirements,
    grounding,
    coverageScore: coverage.score,
    coverageGaps: coverage.gaps,
    domain: domain.domain,
    domainGaps: domain.gaps,
    repaired,
  };
}

/**
 * Writes a pipeline result over the machine-generated requirements, leaving
 * hand-edited ones in place. Every statement commits or none does.
 */
export async function savePipelineResult(projectId: string, result: PipelineResult) {
  // The model names source files; ids are resolved here against the documents
  // that actually exist. A filename the project does not have is dropped rather
  // than stored, so a trace link always points at a real document.
  const documents = await prisma.sourceDocument.findMany({
    where: { projectId },
    select: { id: true, filename: true },
  });
  const idByFilename = new Map(documents.map((d) => [d.filename, d.id]));

  const rows = result.requirements.map((r, index) => {
    const sourceIds = r.sourceFilenames
      .map((filename) => idByFilename.get(filename))
      .filter((id): id is string => Boolean(id));

    const ground = result.grounding.get(index);

    return {
      projectId,
      title: r.title,
      description: r.description,
      type: r.type,
      priority: r.priority,
      actor: r.actor,
      trigger: r.trigger,
      happyPath: r.happyPath,
      alternateFlows: r.alternateFlows.join("\n") || null,
      bdDAC: r.bddAcceptanceCriteria.join("\n") || null,
      checklistAC: r.checklistAcceptanceCriteria.join("\n") || null,
      completionScore: r.completionScore,
      validationGates: r.validationGates.join("\n") || null,
      scope: r.scope,
      packVariant: r.packVariant,
      assumption: r.assumption,
      businessRule: r.businessRule,
      precondition: r.precondition,
      validation: r.validation,
      dependency: r.dependsOn.join("\n") || null,
      // Every extraction covers the whole document set, so a requirement with no
      // named source fell back to all of them rather than none.
      sourceDocumentIds: JSON.stringify(
        sourceIds.length > 0 ? sourceIds : documents.map((d) => d.id),
      ),
      // Only quotes that survived the literal match are stored. An unverified
      // quote is not evidence, and keeping it would let it pass as evidence.
      evidence: JSON.stringify(ground?.verified ?? []),
      isGrounded: ground?.isGrounded ?? false,
    };
  });

  await prisma.$transaction([
    prisma.requirement.deleteMany({ where: { projectId, isEdited: false } }),
    prisma.requirement.createMany({ data: rows }),
    prisma.projectFinding.deleteMany({ where: { projectId } }),
    prisma.projectFinding.createMany({
      data: [
        ...result.coverageGaps.map((gap) => ({
          projectId,
          kind: "coverage-gap",
          title: gap.title,
          detail: gap.whyItMatters,
          evidence: gap.quote,
          severity: gap.severity,
        })),
        ...result.domainGaps.map((gap) => ({
          projectId,
          kind: "domain-gap",
          title: gap.title,
          detail: gap.detail,
          evidence: null,
          severity: gap.severity,
        })),
      ],
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { coverageScore: result.coverageScore },
    }),
  ]);
}
