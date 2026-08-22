import { z } from "zod";
import {
  analysisModeSchema,
  auditActionSchema,
  criterionTypeSchema,
  dependencyTypeSchema,
  entityTypeSchema,
  insightStatusSchema,
  industrySchema,
  insightTypeSchema,
  jurisdictionSchema,
  prioritySchema,
  projectRoleSchema,
  projectStatusSchema,
  regulatorySensitivitySchema,
  requirementStatusSchema,
  requirementTypeSchema,
  scenarioTypeSchema,
  scopeLevelSchema,
  severitySchema,
  sourceProvenanceSchema,
  sourceTypeSchema,
  validationStatusSchema,
} from "./enums";

/**
 * The canonical domain model.
 *
 * These are the shapes the whole app works with. Prisma rows are translated
 * into these by /lib/db/mappers.ts: JSON string columns become real arrays and
 * enum-like String columns become union types. Nothing outside the mappers
 * should touch a `*Json` column.
 */

const flowBranchSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()),
});
export type FlowBranch = z.infer<typeof flowBranchSchema>;

export { flowBranchSchema };

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

export type Project = {
  id: string;
  name: string;
  description: string;
  analysisGoal: string;
  industry: z.infer<typeof industrySchema>;
  subdomain: string | null;
  jurisdiction: z.infer<typeof jurisdictionSchema> | null;
  regulatorySensitivity: z.infer<typeof regulatorySensitivitySchema>;
  solutionDomain: string | null;
  /** Free-form notes. The structured fields above carry the meaning. */
  domainContext: string;
  scenarioType: z.infer<typeof scenarioTypeSchema>;
  ownerId: string | null;
  defaultMode: z.infer<typeof analysisModeSchema>;
  status: z.infer<typeof projectStatusSchema>;
  createdAt: Date;
  updatedAt: Date;
};

export type DomainProfile = {
  id: string;
  projectId: string;
  industry: z.infer<typeof industrySchema>;
  subdomain: string | null;
  jurisdiction: z.infer<typeof jurisdictionSchema> | null;
  regulatorySensitivity: z.infer<typeof regulatorySensitivitySchema>;
  solutionDomain: string | null;
  terminologyHints: string[];
  likelyRiskAreas: string[];
  likelyRequirementThemes: string[];
  likelyComplianceConcerns: string[];
  promptContextSummary: string;
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  id: string;
  email: string;
  /** Null until the person supplies one — a magic-link sign-in carries no name.
   *  Render it through `displayName()` in lib/auth/display-name.ts, never raw. */
  name: string | null;
  createdAt: Date;
};

export type ProjectAccessEntry = {
  id: string;
  projectId: string;
  userId: string;
  role: z.infer<typeof projectRoleSchema>;
  createdAt: Date;
  updatedAt: Date;
};

/** A ProjectAccess row joined to the person it belongs to. */
export type ProjectMember = ProjectAccessEntry & {
  user: User;
};

/** One field-level change, as recorded in an audit entry. */
export type ProjectChange = {
  label: string;
  from: string;
  to: string;
};

export type ProjectAuditEntry = {
  id: string;
  projectId: string;
  action: z.infer<typeof auditActionSchema>;
  entityType: string;
  entityId: string | null;
  changes: ProjectChange[];
  changesSummary: string;
  /** The person who acted, when there was one. */
  user: User | null;
  /** Label for entries with no user behind them, e.g. "migration". */
  changedBy: string;
  createdAt: Date;
};

export type SourceDocument = {
  id: string;
  projectId: string;
  title: string;
  sourceType: z.infer<typeof sourceTypeSchema>;
  content: string;
  uploadedByUserId: string | null;
  /** The uploader's role at upload time, not their role now. */
  uploaderRole: z.infer<typeof projectRoleSchema> | null;
  /** How the material reached us, as opposed to what kind of document it is. */
  sourceProvenance: z.infer<typeof sourceProvenanceSchema>;
  /** When it was created in its origin system. Null when nobody knows. */
  sourceTimestamp: Date | null;
  /** SHA-256 of `content`, for spotting re-uploads. Null on pre-checksum rows. */
  checksumHash: string | null;
  validationStatus: z.infer<typeof validationStatusSchema>;
  validatedByUserId: string | null;
  validatedAt: Date | null;
  /** Why it was rejected, or what was checked when validating. Empty, not null. */
  validationNotes: string;
  createdAt: Date;
  updatedAt: Date;
};

/** A source joined to the people on either side of it, for the intake list. */
export type SourceDocumentWithUploader = SourceDocument & {
  uploadedBy: User | null;
  validatedBy: User | null;
};

export type ExtractedInsight = {
  id: string;
  projectId: string;
  sourceDocumentId: string;
  insightType: z.infer<typeof insightTypeSchema>;
  rawText: string;
  normalizedText: string;
  confidence: number;
  status: z.infer<typeof insightStatusSchema>;
  promotedToType: string | null;
  promotedToId: string | null;
  userEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Stakeholder = {
  id: string;
  projectId: string;
  name: string;
  role: string;
  notes: string;
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type Actor = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type BusinessGoal = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type BusinessRule = {
  id: string;
  projectId: string;
  ruleText: string;
  rationale: string;
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type Requirement = {
  id: string;
  projectId: string;
  ref: string;
  title: string;
  description: string;
  requirementType: z.infer<typeof requirementTypeSchema>;
  priority: z.infer<typeof prioritySchema>;
  status: z.infer<typeof requirementStatusSchema>;
  owner: string;
  rationale: string;
  assumptions: string[];
  constraints: string[];
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type UseCase = {
  id: string;
  projectId: string;
  requirementId: string | null;
  ref: string;
  title: string;
  scopeLevel: z.infer<typeof scopeLevelSchema>;
  primaryActor: string;
  supportingActors: string[];
  trigger: string;
  preconditions: string[];
  postconditions: string[];
  mainFlow: string[];
  alternateFlows: FlowBranch[];
  exceptionFlows: FlowBranch[];
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type AcceptanceCriterion = {
  id: string;
  projectId: string;
  requirementId: string | null;
  ref: string;
  criterionType: z.infer<typeof criterionTypeSchema>;
  text: string;
  testabilityScore: number;
  sourceRefs: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type Dependency = {
  id: string;
  projectId: string;
  fromRequirementId: string;
  toRequirementId: string;
  dependencyType: z.infer<typeof dependencyTypeSchema>;
  notes: string;
  createdAt: Date;
};

export type TraceLink = {
  id: string;
  projectId: string;
  fromEntityType: z.infer<typeof entityTypeSchema>;
  fromEntityId: string;
  toEntityType: z.infer<typeof entityTypeSchema>;
  toEntityId: string;
  linkReason: string;
  createdAt: Date;
};

export type PackOutput = {
  id: string;
  projectId: string;
  mode: z.infer<typeof analysisModeSchema>;
  title: string;
  jsonContent: string;
  markdownContent: string;
  htmlContent: string;
  createdAt: Date;
};

export type AiFinding = {
  id: string;
  projectId: string;
  runId: string;
  severity: z.infer<typeof severitySchema>;
  entityType: string;
  entityId: string;
  title: string;
  explanation: string;
  suggestedFix: string;
  status: "open" | "dismissed";
  createdAt: Date;
};

/**
 * Everything about a project, loaded once. Pack builders, the quality engine
 * and the traceability view all operate on this snapshot rather than issuing
 * their own queries, so they can never disagree about what the project holds.
 */
export type ProjectModel = {
  project: Project;
  sourceDocuments: SourceDocument[];
  insights: ExtractedInsight[];
  stakeholders: Stakeholder[];
  actors: Actor[];
  businessGoals: BusinessGoal[];
  businessRules: BusinessRule[];
  requirements: Requirement[];
  useCases: UseCase[];
  acceptanceCriteria: AcceptanceCriterion[];
  dependencies: Dependency[];
  traceLinks: TraceLink[];
};

// ---------------------------------------------------------------------------
// Input schemas — used by server actions and forms
// ---------------------------------------------------------------------------

const trimmed = z.string().trim();
const optionalText = z.string().trim().default("");

/**
 * Optional free-text that is stored as NULL rather than "" when left blank, so
 * "not answered" and "answered with nothing" stay distinguishable.
 */
const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null);

/** An optional enum from a `<select>`: an empty option means "not answered". */
function nullableEnum<T extends string>(schema: z.ZodType<T>) {
  return z
    .union([z.literal(""), schema])
    .transform((value) => (value === "" ? null : (value as T)))
    .nullable()
    .default(null);
}

export const projectInputSchema = z.object({
  name: trimmed.min(1, "Project name is required").max(120),
  description: optionalText,
  analysisGoal: optionalText,
  // Required with a real default: "other" is a valid answer, a blank is not.
  industry: industrySchema.default("other"),
  subdomain: nullableText,
  jurisdiction: nullableEnum(jurisdictionSchema),
  regulatorySensitivity: regulatorySensitivitySchema.default("low"),
  solutionDomain: nullableText,
  domainContext: optionalText,
  scenarioType: scenarioTypeSchema.default("greenfield"),
  defaultMode: analysisModeSchema,
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectUpdateSchema = projectInputSchema.extend({
  status: projectStatusSchema,
});
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

/**
 * A date the analyst types, e.g. the day of the workshop. Stored at midnight
 * UTC: the day is the information, and inventing a time would read as precision
 * nobody has. An empty field is null, not today — "unknown" is a real answer.
 */
const originDate = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use a date in YYYY-MM-DD form, or leave it empty",
  })
  .transform((value) => (value === null ? null : new Date(`${value}T00:00:00Z`)))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), {
    message: "That is not a real date",
  })
  // Checked here rather than with a `max` on the input: a client component that
  // computes today's date at module scope renders one value on the server and
  // possibly another in the browser, and a hydration warning is a bad trade for
  // a check the server has to make anyway.
  .refine((value) => value === null || value.getTime() <= Date.now(), {
    message: "An origin date in the future is a typo",
  });

export const sourceDocumentInputSchema = z.object({
  title: trimmed.min(1, "Give the source a title").max(200),
  sourceType: sourceTypeSchema,
  sourceProvenance: sourceProvenanceSchema,
  sourceTimestamp: originDate,
  content: trimmed.min(1, "Source content cannot be empty"),
});
export type SourceDocumentInput = z.infer<typeof sourceDocumentInputSchema>;

/**
 * A validation decision. The verb is what the form submits ("validate" /
 * "reject"); `pending` is not offered, because it is where a source starts and
 * where an edit returns it, never something a person chooses.
 */
export const sourceValidationInputSchema = z
  .object({
    validationAction: z.enum(["validate", "reject"]),
    validationNotes: trimmed.max(1000),
  })
  .refine(
    (value) => value.validationAction !== "reject" || value.validationNotes.length > 0,
    {
      path: ["validationNotes"],
      message: "Say why it was rejected — that reason is the point of the record.",
    },
  );
export type SourceValidationInput = z.infer<typeof sourceValidationInputSchema>;

export const stakeholderInputSchema = z.object({
  name: trimmed.min(1, "Name is required"),
  role: optionalText,
  notes: optionalText,
  sourceRefs: z.array(z.string()).default([]),
});
export type StakeholderInput = z.infer<typeof stakeholderInputSchema>;

export const actorInputSchema = z.object({
  name: trimmed.min(1, "Name is required"),
  description: optionalText,
  sourceRefs: z.array(z.string()).default([]),
});
export type ActorInput = z.infer<typeof actorInputSchema>;

export const businessGoalInputSchema = z.object({
  title: trimmed.min(1, "Title is required"),
  description: optionalText,
  sourceRefs: z.array(z.string()).default([]),
});
export type BusinessGoalInput = z.infer<typeof businessGoalInputSchema>;

export const businessRuleInputSchema = z.object({
  ruleText: trimmed.min(1, "Rule text is required"),
  rationale: optionalText,
  sourceRefs: z.array(z.string()).default([]),
});
export type BusinessRuleInput = z.infer<typeof businessRuleInputSchema>;

export const requirementInputSchema = z.object({
  title: trimmed.min(1, "Title is required").max(200),
  description: optionalText,
  requirementType: requirementTypeSchema,
  priority: prioritySchema,
  status: requirementStatusSchema,
  owner: optionalText,
  rationale: optionalText,
  assumptions: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  sourceRefs: z.array(z.string()).default([]),
});
export type RequirementInput = z.infer<typeof requirementInputSchema>;

export const useCaseInputSchema = z.object({
  requirementId: z.string().nullable().default(null),
  title: trimmed.min(1, "Title is required").max(200),
  scopeLevel: scopeLevelSchema,
  primaryActor: optionalText,
  supportingActors: z.array(z.string()).default([]),
  trigger: optionalText,
  preconditions: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  mainFlow: z.array(z.string()).default([]),
  alternateFlows: z.array(flowBranchSchema).default([]),
  exceptionFlows: z.array(flowBranchSchema).default([]),
  sourceRefs: z.array(z.string()).default([]),
});
export type UseCaseInput = z.infer<typeof useCaseInputSchema>;

export const acceptanceCriterionInputSchema = z.object({
  requirementId: z.string().nullable().default(null),
  criterionType: criterionTypeSchema,
  text: trimmed.min(1, "Criterion text is required"),
  sourceRefs: z.array(z.string()).default([]),
});
export type AcceptanceCriterionInput = z.infer<
  typeof acceptanceCriterionInputSchema
>;

export const dependencyInputSchema = z
  .object({
    fromRequirementId: trimmed.min(1, "Pick a source requirement"),
    toRequirementId: trimmed.min(1, "Pick a target requirement"),
    dependencyType: dependencyTypeSchema,
    notes: optionalText,
  })
  .refine((d) => d.fromRequirementId !== d.toRequirementId, {
    message: "A requirement cannot depend on itself",
    path: ["toRequirementId"],
  });
export type DependencyInput = z.infer<typeof dependencyInputSchema>;
