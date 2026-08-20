import { z } from "zod";
import {
  criterionTypeSchema,
  insightTypeSchema,
  prioritySchema,
  requirementTypeSchema,
  scopeLevelSchema,
  severitySchema,
} from "@/lib/schemas/enums";

/**
 * Schemas for AI input and output.
 *
 * These are handed to the Messages API as structured-output formats, so the
 * model is constrained to the shape rather than asked politely for JSON. Keep
 * them free of constraints the API cannot enforce (min/max length, numeric
 * bounds) — those belong in the deterministic quality engine, which is allowed
 * to disagree with the model.
 */

// --- Job 1: source extraction ----------------------------------------------

export const extractedInsightSchema = z.object({
  insightType: insightTypeSchema,
  /** Verbatim span from the source. Must be quotable back to the analyst. */
  rawText: z.string(),
  /** The insight restated as one clean, self-contained sentence. */
  normalizedText: z.string(),
  /** 0-1. How directly the source supports this, not how important it is. */
  confidence: z.number(),
  /**
   * Brownfield only. The model sets these when reading reconstructed material:
   * `contextGap` when the source is too fragmentary to stand on its own,
   * `changeRisk` when acting on the insight would require organisational
   * change. Both are false on greenfield runs, where the prompt does not ask
   * for them.
   */
  contextGap: z.boolean(),
  changeRisk: z.boolean(),
});
export type ExtractedInsightDraft = z.infer<typeof extractedInsightSchema>;

export const extractionOutputSchema = z.object({
  insights: z.array(extractedInsightSchema),
  /** Things the source raises but does not settle. Surfaced as open questions. */
  unresolved: z.array(z.string()),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

// --- Job 2: requirement drafting -------------------------------------------

export const requirementDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  requirementType: requirementTypeSchema,
  priority: prioritySchema,
  rationale: z.string(),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  /** Titles of source documents this came from, matched back to ids by the job. */
  sourceTitles: z.array(z.string()),
});
export type RequirementDraft = z.infer<typeof requirementDraftSchema>;

export const requirementDraftingOutputSchema = z.object({
  requirements: z.array(requirementDraftSchema),
  notes: z.array(z.string()),
});
export type RequirementDraftingOutput = z.infer<
  typeof requirementDraftingOutputSchema
>;

// --- Job 3: use case drafting ----------------------------------------------

export const flowBranchDraftSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()),
});

export const useCaseDraftSchema = z.object({
  title: z.string(),
  scopeLevel: scopeLevelSchema,
  primaryActor: z.string(),
  supportingActors: z.array(z.string()),
  trigger: z.string(),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  mainFlow: z.array(z.string()),
  alternateFlows: z.array(flowBranchDraftSchema),
  exceptionFlows: z.array(flowBranchDraftSchema),
});
export type UseCaseDraft = z.infer<typeof useCaseDraftSchema>;

export const useCaseDraftingOutputSchema = z.object({
  useCase: useCaseDraftSchema,
});

// --- Job 4: acceptance criteria drafting -----------------------------------

export const acceptanceCriterionDraftSchema = z.object({
  criterionType: criterionTypeSchema,
  text: z.string(),
});
export type AcceptanceCriterionDraft = z.infer<
  typeof acceptanceCriterionDraftSchema
>;

export const acceptanceCriteriaOutputSchema = z.object({
  criteria: z.array(acceptanceCriterionDraftSchema),
});

// --- Job 5: quality review -------------------------------------------------

export const aiFindingSchema = z.object({
  severity: severitySchema,
  /** Matches an EntityType value, or "project" for whole-model findings. */
  entityType: z.string(),
  /** The entity's ref (REQ-001) or id. Empty string for project-level findings. */
  entityRef: z.string(),
  title: z.string(),
  explanation: z.string(),
  suggestedFix: z.string(),
});
export type AiFindingDraft = z.infer<typeof aiFindingSchema>;

export const qualityReviewOutputSchema = z.object({
  findings: z.array(aiFindingSchema),
});
export type QualityReviewOutput = z.infer<typeof qualityReviewOutputSchema>;

// --- Job 6: pack narrative -------------------------------------------------

/**
 * The AI writes only the narrative sections of a pack. Every list section
 * (requirements, rules, use cases, criteria, risks) is assembled directly from
 * the stored entities by /lib/pack-builders — so a pack cannot contain a
 * requirement that is not in the model, and every listed item keeps its ref.
 */
export const baNarrativeSchema = z.object({
  overview: z.string(),
  businessProblem: z.string(),
  scope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
    summary: z.string(),
  }),
  openQuestions: z.array(z.string()),
});
export type BaNarrative = z.infer<typeof baNarrativeSchema>;

export const faNarrativeSchema = z.object({
  overview: z.string(),
  functionalScope: z.string(),
  dataValidationConsiderations: z.array(z.string()),
  nonFunctionalConsiderations: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export type FaNarrative = z.infer<typeof faNarrativeSchema>;
