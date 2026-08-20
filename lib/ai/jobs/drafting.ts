import "server-only";
import { prisma } from "@/lib/db/client";
import { encodeFlowBranches, encodeList } from "@/lib/db/mappers";
import { loadProjectModel } from "@/lib/db/queries";
import { allocateRef, allocateRefs } from "@/lib/db/refs";
import { AI_EFFORT } from "@/lib/ai/client";
import { runStructuredJob } from "@/lib/ai/runner";
import {
  acceptanceCriteriaOutputSchema,
  requirementDraftingOutputSchema,
  useCaseDraftingOutputSchema,
} from "@/lib/ai/schemas";
import {
  criteriaDraftingPrompt,
  requirementDraftingPrompt,
  useCaseDraftingPrompt,
} from "@/lib/prompts/drafting";
import { scoreTestability } from "@/lib/quality/testability";
import { recordTraceLink } from "@/lib/trace/links";
import type { AnalysisMode, ScopeLevel } from "@/lib/schemas/enums";

/** Jobs 2, 3 and 4. Each writes entities and the trace links that justify them. */

// --- Job 2 ------------------------------------------------------------------

export async function draftRequirements(
  projectId: string,
  mode: AnalysisMode,
): Promise<{ created: number; notes: string[] }> {
  const model = await loadProjectModel(projectId);
  if (!model) throw new Error("Project not found");

  const sourceTitles = new Map(model.sourceDocuments.map((s) => [s.title, s.id]));

  const candidates = model.insights
    .filter((i) => i.insightType === "requirement_candidate")
    .filter((i) => i.status === "accepted" || i.status === "pending")
    .map((i) => ({
      text: i.normalizedText,
      sourceTitle:
        model.sourceDocuments.find((s) => s.id === i.sourceDocumentId)?.title ?? "",
    }));

  if (candidates.length === 0) {
    throw new Error(
      "No candidate requirements available. Run extraction first, then review the candidates on the extraction screen.",
    );
  }

  const acceptedOf = (type: string) =>
    model.insights
      .filter((i) => i.insightType === type && i.status !== "dismissed")
      .map((i) => i.normalizedText);

  const { data } = await runStructuredJob({
    projectId,
    job: "requirement_drafting",
    prompt: requirementDraftingPrompt,
    context: { project: model.project, mode },
    input: {
      mode,
      goals: model.businessGoals.map((g) => g.title),
      rules: model.businessRules.map((r) => r.ruleText),
      actors: model.actors.map((a) => a.name),
      candidates,
      assumptions: acceptedOf("assumption"),
      constraints: acceptedOf("constraint"),
      existingTitles: model.requirements.map((r) => r.title),
    },
    schema: requirementDraftingOutputSchema,
    inputEntityIds: model.insights
      .filter((i) => i.insightType === "requirement_candidate")
      .map((i) => i.id),
    effort: AI_EFFORT.drafting,
  });

  const refs = await allocateRefs("requirement", projectId, data.requirements.length);

  for (const [index, draft] of data.requirements.entries()) {
    // The model returns source titles; resolve them back to ids here rather
    // than trusting it with opaque cuids it has no way to verify.
    const refIds = draft.sourceTitles
      .map((title) => sourceTitles.get(title.trim()))
      .filter((id): id is string => Boolean(id));

    const created = await prisma.requirement.create({
      data: {
        projectId,
        ref: refs[index],
        title: draft.title.trim(),
        description: draft.description.trim(),
        requirementType: draft.requirementType,
        priority: draft.priority,
        status: "draft",
        rationale: draft.rationale.trim(),
        assumptionsJson: encodeList(draft.assumptions),
        constraintsJson: encodeList(draft.constraints),
        sourceRefsJson: encodeList(refIds),
      },
    });

    for (const sourceId of refIds) {
      await recordTraceLink({
        projectId,
        fromEntityType: "source_document",
        fromEntityId: sourceId,
        toEntityType: "requirement",
        toEntityId: created.id,
        linkReason: "Drafted from this source by the requirement drafting job",
      });
    }
  }

  return { created: data.requirements.length, notes: data.notes };
}

// --- Job 3 ------------------------------------------------------------------

export async function draftUseCase(
  projectId: string,
  requirementId: string,
  mode: AnalysisMode,
  scopeLevel: ScopeLevel,
): Promise<{ ref: string }> {
  const model = await loadProjectModel(projectId);
  if (!model) throw new Error("Project not found");

  const requirement = model.requirements.find((r) => r.id === requirementId);
  if (!requirement) throw new Error("Requirement not found");

  const { data } = await runStructuredJob({
    projectId,
    job: "use_case_drafting",
    prompt: useCaseDraftingPrompt,
    context: { project: model.project, mode },
    input: {
      mode,
      requirement: {
        ref: requirement.ref,
        title: requirement.title,
        description: requirement.description,
        rationale: requirement.rationale,
      },
      actors: model.actors.map((a) =>
        a.description ? `${a.name} — ${a.description}` : a.name,
      ),
      rules: model.businessRules.map((r) => r.ruleText),
      scopeLevel,
    },
    schema: useCaseDraftingOutputSchema,
    inputEntityIds: [requirement.id],
    effort: AI_EFFORT.drafting,
  });

  const draft = data.useCase;
  const ref = await allocateRef("useCase", projectId);

  const created = await prisma.useCase.create({
    data: {
      projectId,
      ref,
      requirementId,
      title: draft.title.trim(),
      scopeLevel: draft.scopeLevel,
      primaryActor: draft.primaryActor.trim(),
      trigger: draft.trigger.trim(),
      supportingActorsJson: encodeList(draft.supportingActors),
      preconditionsJson: encodeList(draft.preconditions),
      postconditionsJson: encodeList(draft.postconditions),
      mainFlowJson: encodeList(draft.mainFlow),
      alternateFlowsJson: encodeFlowBranches(draft.alternateFlows),
      exceptionFlowsJson: encodeFlowBranches(draft.exceptionFlows),
      // A use case realising a requirement inherits its evidence — the sources
      // that justified the requirement justify the flow that delivers it.
      sourceRefsJson: encodeList(requirement.sourceRefs),
    },
  });

  await recordTraceLink({
    projectId,
    fromEntityType: "requirement",
    fromEntityId: requirement.id,
    toEntityType: "use_case",
    toEntityId: created.id,
    linkReason: `Drafted from ${requirement.ref} by the use case drafting job`,
  });

  return { ref };
}

// --- Job 4 ------------------------------------------------------------------

export async function draftAcceptanceCriteria(
  projectId: string,
  requirementId: string,
  mode: AnalysisMode,
): Promise<{ created: number }> {
  const model = await loadProjectModel(projectId);
  if (!model) throw new Error("Project not found");

  const requirement = model.requirements.find((r) => r.id === requirementId);
  if (!requirement) throw new Error("Requirement not found");

  const useCases = model.useCases.filter((u) => u.requirementId === requirementId);
  const existing = model.acceptanceCriteria
    .filter((a) => a.requirementId === requirementId)
    .map((a) => a.text);

  const { data } = await runStructuredJob({
    projectId,
    job: "acceptance_criteria_drafting",
    prompt: criteriaDraftingPrompt,
    context: { project: model.project, mode },
    input: {
      mode,
      requirement: {
        ref: requirement.ref,
        title: requirement.title,
        description: requirement.description,
      },
      useCases: useCases.map((u) => ({
        title: u.title,
        mainFlow: u.mainFlow,
        exceptionFlows: u.exceptionFlows.map(
          (f) => `${f.name}: ${f.steps.join("; ")}`,
        ),
      })),
      rules: model.businessRules.map((r) => r.ruleText),
      existing,
    },
    schema: acceptanceCriteriaOutputSchema,
    inputEntityIds: [requirement.id, ...useCases.map((u) => u.id)],
    effort: AI_EFFORT.drafting,
  });

  const refs = await allocateRefs(
    "acceptanceCriterion",
    projectId,
    data.criteria.length,
  );

  for (const [index, draft] of data.criteria.entries()) {
    const created = await prisma.acceptanceCriterion.create({
      data: {
        projectId,
        ref: refs[index],
        requirementId,
        criterionType: draft.criterionType,
        text: draft.text.trim(),
        // Scored by the deterministic engine, not by the model — the model does
        // not get to grade its own output.
        testabilityScore: scoreTestability(draft.text),
        sourceRefsJson: encodeList(requirement.sourceRefs),
      },
    });

    await recordTraceLink({
      projectId,
      fromEntityType: "requirement",
      fromEntityId: requirement.id,
      toEntityType: "acceptance_criterion",
      toEntityId: created.id,
      linkReason: `Drafted from ${requirement.ref} by the acceptance criteria job`,
    });
  }

  return { created: data.criteria.length };
}
