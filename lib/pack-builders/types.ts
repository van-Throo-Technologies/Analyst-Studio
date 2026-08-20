import { z } from "zod";
import { analysisModeSchema } from "@/lib/schemas/enums";

/**
 * Pack JSON — the canonical output shape.
 *
 * Markdown and HTML are both rendered from this, never written independently,
 * so the three formats can never disagree. Every list item carries its `ref`
 * and `sourceRefs`, which is what makes an exported pack traceable back into
 * the model it came from.
 */

const packItemBase = {
  ref: z.string(),
  sourceRefs: z.array(z.string()),
};

export const packRequirementSchema = z.object({
  ...packItemBase,
  title: z.string(),
  description: z.string(),
  requirementType: z.string(),
  priority: z.string(),
  status: z.string(),
  owner: z.string(),
  rationale: z.string(),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  acceptanceCriteriaRefs: z.array(z.string()),
});
export type PackRequirement = z.infer<typeof packRequirementSchema>;

export const packUseCaseSchema = z.object({
  ...packItemBase,
  title: z.string(),
  scopeLevel: z.string(),
  primaryActor: z.string(),
  supportingActors: z.array(z.string()),
  trigger: z.string(),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  mainFlow: z.array(z.string()),
  alternateFlows: z.array(z.object({ name: z.string(), steps: z.array(z.string()) })),
  exceptionFlows: z.array(z.object({ name: z.string(), steps: z.array(z.string()) })),
  realisesRequirementRef: z.string().nullable(),
});
export type PackUseCase = z.infer<typeof packUseCaseSchema>;

export const packCriterionSchema = z.object({
  ...packItemBase,
  text: z.string(),
  criterionType: z.string(),
  testabilityScore: z.number(),
  verifiesRequirementRef: z.string().nullable(),
});
export type PackCriterion = z.infer<typeof packCriterionSchema>;

export const packRuleSchema = z.object({
  ...packItemBase,
  ruleText: z.string(),
  rationale: z.string(),
});

export const packStakeholderSchema = z.object({
  ...packItemBase,
  name: z.string(),
  role: z.string(),
  notes: z.string(),
});

export const packGoalSchema = z.object({
  ...packItemBase,
  title: z.string(),
  description: z.string(),
});

export const packRiskSchema = z.object({
  ...packItemBase,
  text: z.string(),
});

export const packDependencySchema = z.object({
  fromRef: z.string(),
  toRef: z.string(),
  dependencyType: z.string(),
  notes: z.string(),
});

/** Provenance stamped onto every generated pack. */
export const packMetaSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  mode: analysisModeSchema,
  generatedAt: z.string(),
  model: z.string(),
  narrativePromptId: z.string(),
  narrativePromptVersion: z.string(),
  /** Set when the pack was assembled without an AI narrative. */
  narrativeSource: z.enum(["ai", "model_only"]),
  sourceDocuments: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type PackMeta = z.infer<typeof packMetaSchema>;

// --- BA pack ---------------------------------------------------------------

export const baPackSchema = z.object({
  meta: packMetaSchema,
  overview: z.string(),
  businessProblem: z.string(),
  businessGoals: z.array(packGoalSchema),
  stakeholders: z.array(packStakeholderSchema),
  scope: z.object({
    summary: z.string(),
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
  }),
  assumptions: z.array(packRiskSchema),
  constraints: z.array(packRiskSchema),
  businessRules: z.array(packRuleSchema),
  requirements: z.array(packRequirementSchema),
  highLevelUseCases: z.array(packUseCaseSchema),
  acceptanceCriteria: z.array(packCriterionSchema),
  risks: z.array(packRiskSchema),
  openQuestions: z.array(z.string()),
});
export type BaPack = z.infer<typeof baPackSchema>;

// --- FA pack ---------------------------------------------------------------

export const faPackSchema = z.object({
  meta: packMetaSchema,
  overview: z.string(),
  functionalScope: z.string(),
  functionalRequirements: z.array(packRequirementSchema),
  businessRulesImpactingBehavior: z.array(packRuleSchema),
  detailedUseCases: z.array(packUseCaseSchema),
  dataValidationConsiderations: z.array(z.string()),
  dependencies: z.array(packDependencySchema),
  nonFunctionalConsiderations: z.array(z.string()),
  acceptanceCriteria: z.array(packCriterionSchema),
  risks: z.array(packRiskSchema),
  openQuestions: z.array(z.string()),
});
export type FaPack = z.infer<typeof faPackSchema>;

export type Pack = BaPack | FaPack;

export function isBaPack(pack: Pack): pack is BaPack {
  return pack.meta.mode === "BA";
}

/** Section order, used by the renderers and by the regenerate-section UI. */
export const BA_SECTIONS = [
  { key: "overview", label: "Project overview" },
  { key: "businessProblem", label: "Business problem" },
  { key: "businessGoals", label: "Business goals" },
  { key: "stakeholders", label: "Stakeholders" },
  { key: "scope", label: "Scope" },
  { key: "assumptionsConstraints", label: "Assumptions and constraints" },
  { key: "businessRules", label: "Business rules" },
  { key: "requirements", label: "High-level requirements" },
  { key: "highLevelUseCases", label: "High-level use cases" },
  { key: "acceptanceCriteria", label: "Business acceptance criteria" },
  { key: "risks", label: "Risks and open questions" },
] as const;

export const FA_SECTIONS = [
  { key: "overview", label: "Project overview" },
  { key: "functionalScope", label: "Functional scope" },
  { key: "functionalRequirements", label: "Functional requirements" },
  { key: "businessRulesImpactingBehavior", label: "Business rules impacting solution behaviour" },
  { key: "detailedUseCases", label: "Detailed use cases" },
  { key: "dataValidationConsiderations", label: "Data and validation considerations" },
  { key: "dependencies", label: "Dependencies" },
  { key: "nonFunctionalConsiderations", label: "Non-functional considerations" },
  { key: "acceptanceCriteria", label: "Functional acceptance criteria" },
  { key: "risks", label: "Risks and open questions" },
] as const;

/**
 * Which sections are model-written prose versus assembled from entities.
 *
 * Lives here rather than beside the regeneration job because the pack preview
 * is a client component and must not pull a server-only module (and its
 * database client) into the browser bundle.
 */
export const NARRATIVE_SECTIONS = [
  "overview",
  "businessProblem",
  "scope",
  "functionalScope",
  "dataValidationConsiderations",
  "nonFunctionalConsiderations",
  "openQuestions",
] as const;

export type NarrativeSection = (typeof NARRATIVE_SECTIONS)[number];

export function isNarrativeSection(value: string): value is NarrativeSection {
  return (NARRATIVE_SECTIONS as readonly string[]).includes(value);
}
