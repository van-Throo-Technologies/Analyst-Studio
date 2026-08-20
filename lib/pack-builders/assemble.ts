import type { ProjectModel } from "@/lib/schemas/entities";
import { PRIORITY_ORDER } from "@/lib/schemas/enums";
import type { BaNarrative, FaNarrative } from "@/lib/ai/schemas";
import type {
  BaPack,
  FaPack,
  PackCriterion,
  PackMeta,
  PackRequirement,
  PackUseCase,
} from "@/lib/pack-builders/types";

/**
 * Deterministic pack assembly.
 *
 * Everything factual in a pack — requirements, rules, use cases, criteria,
 * risks, dependencies — is copied straight from the stored entities. The AI
 * contributes only the narrative sections, which are passed in.
 *
 * This is the single most important design decision in the product: a pack
 * cannot contain a requirement that is not in the model, cannot renumber
 * anything, and cannot quietly reword a business rule. Regenerating a pack with
 * an unchanged model produces the same lists every time.
 */

export type AssembleOptions = {
  model: ProjectModel;
  meta: PackMeta;
};

export function assembleBaPack(
  options: AssembleOptions & { narrative: BaNarrative },
): BaPack {
  const { model, meta, narrative } = options;
  const refs = refIndex(model);

  // BA packs present the business and functional requirements — the ones a
  // sponsor signs off. Detailed non-functional behaviour belongs in the FA pack.
  const requirements = sortByPriority(
    model.requirements.filter((r) => r.requirementType !== "non_functional"),
  );

  const useCases = model.useCases.filter((u) => u.scopeLevel === "high_level");
  const criteria = model.acceptanceCriteria.filter(
    (a) => a.criterionType === "business" || a.criterionType === "non_functional",
  );

  return {
    meta,
    overview: narrative.overview,
    businessProblem: narrative.businessProblem,
    businessGoals: model.businessGoals.map((g) => ({
      ref: shortRef("GOAL", g.id),
      sourceRefs: g.sourceRefs,
      title: g.title,
      description: g.description,
    })),
    stakeholders: model.stakeholders.map((s) => ({
      ref: shortRef("STK", s.id),
      sourceRefs: s.sourceRefs,
      name: s.name,
      role: s.role,
      notes: s.notes,
    })),
    scope: {
      summary: narrative.scope.summary,
      inScope: narrative.scope.inScope,
      outOfScope: narrative.scope.outOfScope,
    },
    assumptions: registerEntries(model, "assumption"),
    constraints: registerEntries(model, "constraint"),
    businessRules: model.businessRules.map((r) => ({
      ref: shortRef("BR", r.id),
      sourceRefs: r.sourceRefs,
      ruleText: r.ruleText,
      rationale: r.rationale,
    })),
    requirements: requirements.map((r) => toPackRequirement(r, model)),
    highLevelUseCases: useCases.map((u) => toPackUseCase(u, refs)),
    acceptanceCriteria: criteria.map((a) => toPackCriterion(a, refs)),
    risks: registerEntries(model, "risk"),
    openQuestions: narrative.openQuestions,
  };
}

export function assembleFaPack(
  options: AssembleOptions & { narrative: FaNarrative },
): FaPack {
  const { model, meta, narrative } = options;
  const refs = refIndex(model);

  // FA packs carry functional and non-functional requirements. Purely business
  // requirements have already been agreed in the BA pack.
  const requirements = sortByPriority(
    model.requirements.filter((r) => r.requirementType !== "business"),
  );

  // Detailed use cases are the point of an FA pack, but shipping a pack with an
  // empty use case section because nobody set the scope level would be worse
  // than including the high-level ones — so fall back rather than omit.
  const detailed = model.useCases.filter((u) => u.scopeLevel === "detailed");
  const useCases = detailed.length > 0 ? detailed : model.useCases;

  const criteria = model.acceptanceCriteria.filter(
    (a) => a.criterionType !== "business",
  );

  return {
    meta,
    overview: narrative.overview,
    functionalScope: narrative.functionalScope,
    functionalRequirements: requirements.map((r) => toPackRequirement(r, model)),
    businessRulesImpactingBehavior: model.businessRules.map((r) => ({
      ref: shortRef("BR", r.id),
      sourceRefs: r.sourceRefs,
      ruleText: r.ruleText,
      rationale: r.rationale,
    })),
    detailedUseCases: useCases.map((u) => toPackUseCase(u, refs)),
    dataValidationConsiderations: narrative.dataValidationConsiderations,
    dependencies: model.dependencies.map((d) => ({
      fromRef: refs.requirements.get(d.fromRequirementId) ?? "?",
      toRef: refs.requirements.get(d.toRequirementId) ?? "?",
      dependencyType: d.dependencyType,
      notes: d.notes,
    })),
    nonFunctionalConsiderations: narrative.nonFunctionalConsiderations,
    acceptanceCriteria: criteria.map((a) => toPackCriterion(a, refs)),
    risks: registerEntries(model, "risk"),
    openQuestions: narrative.openQuestions,
  };
}

/**
 * A pack assembled with no AI narrative. Used when the API key is absent or a
 * narrative run fails — the analyst still gets a complete, accurate pack of
 * everything in the model, with the narrative gaps stated plainly rather than
 * filled with invented prose.
 */
export function emptyBaNarrative(model: ProjectModel): BaNarrative {
  return {
    overview:
      model.project.description ||
      `${model.project.name}. No overview has been written — generate the pack with AI enabled, or write this section by hand after export.`,
    businessProblem:
      model.project.analysisGoal ||
      "The business problem has not been written. Set the analysis goal in project settings, then regenerate.",
    scope: {
      summary:
        "Scope has not been written. It is derived from the requirement model on generation.",
      inScope: model.businessGoals.map((g) => g.title),
      outOfScope: [],
    },
    openQuestions: pendingQuestions(model),
  };
}

export function emptyFaNarrative(model: ProjectModel): FaNarrative {
  return {
    overview:
      model.project.description ||
      `${model.project.name}. No overview has been written — generate the pack with AI enabled, or write this section by hand after export.`,
    functionalScope:
      "Functional scope has not been written. It is derived from the requirement model on generation.",
    dataValidationConsiderations: [],
    nonFunctionalConsiderations: model.requirements
      .filter((r) => r.requirementType === "non_functional")
      .map((r) => `${r.ref}: ${r.title}`),
    openQuestions: pendingQuestions(model),
  };
}

// ---------------------------------------------------------------------------

type RefIndex = {
  requirements: Map<string, string>;
};

function refIndex(model: ProjectModel): RefIndex {
  return {
    requirements: new Map(model.requirements.map((r) => [r.id, r.ref])),
  };
}

function toPackRequirement(
  requirement: ProjectModel["requirements"][number],
  model: ProjectModel,
): PackRequirement {
  return {
    ref: requirement.ref,
    sourceRefs: requirement.sourceRefs,
    title: requirement.title,
    description: requirement.description,
    requirementType: requirement.requirementType,
    priority: requirement.priority,
    status: requirement.status,
    owner: requirement.owner,
    rationale: requirement.rationale,
    assumptions: requirement.assumptions,
    constraints: requirement.constraints,
    acceptanceCriteriaRefs: model.acceptanceCriteria
      .filter((a) => a.requirementId === requirement.id)
      .map((a) => a.ref),
  };
}

function toPackUseCase(
  useCase: ProjectModel["useCases"][number],
  refs: RefIndex,
): PackUseCase {
  return {
    ref: useCase.ref,
    sourceRefs: useCase.sourceRefs,
    title: useCase.title,
    scopeLevel: useCase.scopeLevel,
    primaryActor: useCase.primaryActor,
    supportingActors: useCase.supportingActors,
    trigger: useCase.trigger,
    preconditions: useCase.preconditions,
    postconditions: useCase.postconditions,
    mainFlow: useCase.mainFlow,
    alternateFlows: useCase.alternateFlows,
    exceptionFlows: useCase.exceptionFlows,
    realisesRequirementRef: useCase.requirementId
      ? (refs.requirements.get(useCase.requirementId) ?? null)
      : null,
  };
}

function toPackCriterion(
  criterion: ProjectModel["acceptanceCriteria"][number],
  refs: RefIndex,
): PackCriterion {
  return {
    ref: criterion.ref,
    sourceRefs: criterion.sourceRefs,
    text: criterion.text,
    criterionType: criterion.criterionType,
    testabilityScore: criterion.testabilityScore,
    verifiesRequirementRef: criterion.requirementId
      ? (refs.requirements.get(criterion.requirementId) ?? null)
      : null,
  };
}

/**
 * Assumptions, constraints and risks live as accepted extracted insights rather
 * than as their own tables (see the extraction actions for why). Dismissed ones
 * are excluded; everything else carries its source through to the pack.
 */
function registerEntries(model: ProjectModel, insightType: string) {
  return model.insights
    .filter((i) => i.insightType === insightType && i.status !== "dismissed")
    .map((i) => ({
      ref: shortRef(insightType.slice(0, 3).toUpperCase(), i.id),
      sourceRefs: [i.sourceDocumentId],
      text: i.normalizedText,
    }));
}

function pendingQuestions(model: ProjectModel): string[] {
  const questions: string[] = [];
  const pending = model.insights.filter((i) => i.status === "pending").length;
  if (pending > 0) {
    questions.push(
      `${pending} extracted insight${pending === 1 ? " has" : "s have"} not yet been reviewed.`,
    );
  }
  const noSource = model.requirements.filter((r) => r.sourceRefs.length === 0).length;
  if (noSource > 0) {
    questions.push(
      `${noSource} requirement${noSource === 1 ? "" : "s"} ${noSource === 1 ? "has" : "have"} no linked source.`,
    );
  }
  return questions;
}

function sortByPriority<T extends { priority: keyof typeof PRIORITY_ORDER; ref: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return byPriority !== 0 ? byPriority : a.ref.localeCompare(b.ref);
  });
}

/** Stable short ref for entities that have no ref column of their own. */
function shortRef(prefix: string, id: string): string {
  return `${prefix}-${id.slice(-4).toUpperCase()}`;
}
