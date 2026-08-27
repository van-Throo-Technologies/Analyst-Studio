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
  SubtypeSchema,
  SUBTYPE_SYSTEM,
  parseStreamed,
  type ExtractedRequirement,
  type Subtypes,
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
  | "subtypes"
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
    // A multi-document brief runs long: the KYC case yields ~60 features, each
    // carrying a dozen fields plus quotes. It truncated at 32k, then again at
    // 64k. This is the model ceiling — beyond it the answer is to split the
    // material, not to ask for a bigger reply.
    max_tokens: 128000,
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

  let message;
  try {
    message = await stream.finalMessage();
  } catch (error) {
    // With output_config.format the SDK parses before returning, so a truncated
    // reply surfaces here as a JSON syntax error rather than as stop_reason:
    // max_tokens. Raw parser output tells the reader nothing they can act on.
    const detail = error instanceof Error ? error.message : String(error);
    if (/parse|JSON/i.test(detail)) {
      throw new ExtractionError(
        "The response was cut off before it finished — this material produced more requirements than fit in a single reply. Split it across two projects and run each separately.",
      );
    }
    throw error;
  }

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("The model declined to process this material.");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return ExtractionSchema.parse(JSON.parse(text)).features;
  } catch {
    throw new ExtractionError(
      message.stop_reason === "max_tokens"
        ? "The material produced more requirements than fit in one response. Split it across two projects and try again."
        : "The model returned a response that did not match the expected shape.",
    );
  }
}

const EMPTY_SUBTYPES: Subtypes = {
  businessRules: [],
  regulatoryConstraints: [],
  useCases: [],
};

export type PipelineResult = {
  requirements: ExtractedRequirement[];
  extras: Subtypes;
  // The assembled source, kept so child records can be grounded at save time
  // against exactly the text the model was shown.
  material: string;
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

  // --- subtypes -----------------------------------------------------------
  // A second call, given the feature titles just produced so that every child
  // links to a title that really exists. Repair, grounding and the audit passes
  // below operate on features only: the child kinds are short quoted statements
  // with far less room to be vague, and running them through a pass that
  // restates everything would multiply the slowest stage for little gain.
  emit({ type: "stage", stage: "subtypes", label: "Separating rules, constraints and use cases" });
  const titles = requirements.map((r) => `- ${r.title}`).join("\n");
  const extras =
    (await parseStreamed(SubtypeSchema, {
      system: SUBTYPE_SYSTEM,
      content: `Source material:\n\n${material}\n\nFeature titles already extracted:\n\n${titles || "(none)"}`,
      // Scales with the feature count, not fixed: 52 features produced ~90k
      // characters of rules, constraints and use cases and truncated at 32k.
      maxTokens: 64000,
    })) ?? EMPTY_SUBTYPES;

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
    extras,
    material,
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
  const allDocumentIds = documents.map((d) => d.id);

  const traceIds = (filenames: string[]) => {
    const ids = filenames
      .map((filename) => idByFilename.get(filename))
      .filter((id): id is string => Boolean(id));
    // Extraction covers the whole document set, so a record naming no source
    // fell back to all of them rather than none.
    return JSON.stringify(ids.length > 0 ? ids : allDocumentIds);
  };

  const material = result.material;

  const featureRows = result.requirements.map((r, index) => {
    const ground = result.grounding.get(index);
    return {
      projectId,
      recordType: "feature",
      parentRequirementId: null as string | null,
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
      sourceDocumentIds: traceIds(r.sourceFilenames),
      // Only quotes that survived the literal match are stored. An unverified
      // quote is not evidence, and keeping it would let it pass as evidence.
      evidence: JSON.stringify(ground?.verified ?? []),
      isGrounded: ground?.isGrounded ?? false,
    };
  });

  await prisma.$transaction(async (tx) => {
    // Deleting a feature cascades to its children, so orphaned rules and
    // criteria cannot survive a re-run. Hand-edited records are left alone.
    await tx.requirement.deleteMany({ where: { projectId, isEdited: false } });
    await tx.requirement.createMany({ data: featureRows });

    // Children link by title, so the parents must exist before they are read.
    const saved = await tx.requirement.findMany({
      where: { projectId, recordType: "feature" },
      select: { id: true, title: true },
    });
    const featureIdByTitle = new Map(saved.map((f) => [f.title, f.id]));
    const parentIdFor = (title: string | null) =>
      title ? featureIdByTitle.get(title) ?? null : null;

    // Child records are grounded the same way features are: the quote either
    // appears in the source or it is not stored.
    const groundChild = (quotes: string[]) => {
      const { verified, isGrounded } = verifyEvidence(quotes, material);
      return { evidence: JSON.stringify(verified), isGrounded };
    };

    const childRows = [
      ...result.extras.businessRules.map((rule) => ({
        projectId,
        recordType: "business-rule",
        parentRequirementId: parentIdFor(rule.parentFeatureTitle),
        title: rule.title,
        description: rule.description,
        // The rule itself lives in businessRule, which is where every reader
        // and every export already looks for one.
        businessRule: rule.statement,
        type: "Business",
        priority: "Medium",
        completionScore: 0,
        sourceDocumentIds: traceIds(rule.sourceFilenames),
        ...groundChild(rule.evidence),
      })),

      ...result.extras.regulatoryConstraints.map((constraint) => ({
        projectId,
        recordType: "regulatory-constraint",
        parentRequirementId: parentIdFor(constraint.parentFeatureTitle),
        title: constraint.title,
        description: constraint.description,
        businessRule: constraint.statement,
        // The naming framework, where the source gave one. Kept in validation
        // rather than invented into the title.
        validation: constraint.framework,
        type: "Non-Functional",
        priority: "High",
        completionScore: 0,
        sourceDocumentIds: traceIds(constraint.sourceFilenames),
        ...groundChild(constraint.evidence),
      })),

      ...result.extras.useCases.map((useCase) => ({
        projectId,
        recordType: "use-case",
        parentRequirementId: parentIdFor(useCase.parentFeatureTitle),
        title: useCase.title,
        description: useCase.description,
        actor: useCase.actor,
        trigger: useCase.trigger,
        precondition: useCase.precondition,
        happyPath: useCase.mainFlow,
        alternateFlows: useCase.alternateFlows.join("\n") || null,
        type: "Functional",
        priority: "Medium",
        completionScore: 0,
        sourceDocumentIds: traceIds(useCase.sourceFilenames),
        ...groundChild(useCase.evidence),
      })),

      // Acceptance criteria are split out of the parent's own fields rather
      // than asked of the model. The lines already exist; turning them into
      // rows costs nothing, where asking for hundreds more objects would have
      // truncated the reply that produced them.
      ...saved.flatMap((feature) => {
        const parent = featureRows.find((f) => f.title === feature.title);
        if (!parent) return [];
        const criteria = [
          ...(parent.bdDAC ?? "").split("\n"),
          ...(parent.checklistAC ?? "").split("\n"),
        ]
          .map((line) => line.trim())
          .filter(Boolean);

        return criteria.map((line) => ({
          projectId,
          recordType: "acceptance-criteria",
          parentRequirementId: feature.id,
          // The criterion is the title; a separate description would restate it.
          title: line.length > 180 ? `${line.slice(0, 177)}…` : line,
          description: line,
          type: parent.type,
          priority: parent.priority,
          completionScore: 0,
          sourceDocumentIds: parent.sourceDocumentIds,
          // Inherited: the criterion came out of a parent whose evidence was
          // already checked, and it is not separately quotable.
          evidence: JSON.stringify([]),
          isGrounded: parent.isGrounded,
        }));
      }),
    ];

    if (childRows.length > 0) await tx.requirement.createMany({ data: childRows });

    await tx.projectFinding.deleteMany({ where: { projectId } });
    await tx.projectFinding.createMany({
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
    });

    await tx.project.update({
      where: { id: projectId },
      data: { coverageScore: result.coverageScore },
    });
  });
}
