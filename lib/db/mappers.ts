import { z } from "zod";
import type * as Rows from "@prisma/client";
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
} from "@/lib/schemas/enums";
import { flowBranchSchema } from "@/lib/schemas/entities";
import type * as Domain from "@/lib/schemas/entities";

/**
 * The only place that knows about the SQLite storage compromises
 * (JSON-in-a-String columns, enum-as-String columns).
 *
 * Decoding is deliberately forgiving: a row written by an older schema version
 * or hand-edited in a SQL client should degrade to a sane default rather than
 * crash a page render. Writes, by contrast, always go through the Zod input
 * schemas, so bad values cannot enter the database through the app.
 */

function decodeStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function decodeFlowBranches(raw: string): Domain.FlowBranch[] {
  try {
    const parsed = z.array(flowBranchSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function decodeEnum<T extends string>(
  schema: z.ZodType<T>,
  value: string,
  fallback: T,
): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function encodeList(values: readonly string[]): string {
  return JSON.stringify(values.map((v) => v.trim()).filter((v) => v.length > 0));
}

export function encodeFlowBranches(
  branches: readonly Domain.FlowBranch[],
): string {
  return JSON.stringify(
    branches
      .map((b) => ({
        name: b.name.trim(),
        steps: b.steps.map((s) => s.trim()).filter((s) => s.length > 0),
      }))
      .filter((b) => b.name.length > 0 || b.steps.length > 0),
  );
}

// ---------------------------------------------------------------------------

/** Decodes a nullable enum column, treating an unknown value as unanswered. */
function decodeNullableEnum<T extends string>(
  schema: z.ZodType<T>,
  value: string | null,
): T | null {
  if (value === null || value.length === 0) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toProject(row: Rows.Project): Domain.Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    analysisGoal: row.analysisGoal,
    industry: decodeEnum(industrySchema, row.industry, "other"),
    subdomain: emptyToNull(row.subdomain),
    jurisdiction: decodeNullableEnum(jurisdictionSchema, row.jurisdiction),
    regulatorySensitivity: decodeEnum(
      regulatorySensitivitySchema,
      row.regulatorySensitivity,
      "low",
    ),
    solutionDomain: emptyToNull(row.solutionDomain),
    domainContext: row.domainContext,
    scenarioType: decodeEnum(scenarioTypeSchema, row.scenarioType, "greenfield"),
    ownerId: row.ownerId,
    defaultMode: decodeEnum(analysisModeSchema, row.defaultMode, "BA"),
    status: decodeEnum(projectStatusSchema, row.status, "draft"),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainProfile(row: Rows.DomainProfile): Domain.DomainProfile {
  return {
    id: row.id,
    projectId: row.projectId,
    industry: decodeEnum(industrySchema, row.industry, "other"),
    subdomain: emptyToNull(row.subdomain),
    jurisdiction: decodeNullableEnum(jurisdictionSchema, row.jurisdiction),
    regulatorySensitivity: decodeEnum(
      regulatorySensitivitySchema,
      row.regulatorySensitivity,
      "low",
    ),
    solutionDomain: emptyToNull(row.solutionDomain),
    terminologyHints: decodeStringArray(row.terminologyHintsJson),
    likelyRiskAreas: decodeStringArray(row.likelyRiskAreasJson),
    likelyRequirementThemes: decodeStringArray(row.likelyRequirementThemesJson),
    likelyComplianceConcerns: decodeStringArray(row.likelyComplianceConcernsJson),
    promptContextSummary: row.promptContextSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toUser(row: Rows.User): Domain.User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
  };
}

export function toProjectAccess(
  row: Rows.ProjectAccess,
): Domain.ProjectAccessEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    role: decodeEnum(projectRoleSchema, row.role, "REVIEWER"),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function decodeChanges(raw: string): Domain.ProjectChange[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is Domain.ProjectChange =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as Domain.ProjectChange).label === "string",
    );
  } catch {
    return [];
  }
}

export function toProjectAuditEntry(
  row: Rows.ProjectAuditLog & { user?: Rows.User | null },
): Domain.ProjectAuditEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    action: decodeEnum(auditActionSchema, row.action, "settings_changed"),
    entityType: row.entityType,
    entityId: row.entityId,
    changes: decodeChanges(row.changesJson),
    changesSummary: row.changesSummary,
    user: row.user ? toUser(row.user) : null,
    changedBy: row.changedBy,
    createdAt: row.createdAt,
  };
}

/** A blank optional column and a NULL one mean the same thing: unanswered. */
function emptyToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function toSourceDocument(row: Rows.SourceDocument): Domain.SourceDocument {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    sourceType: decodeEnum(sourceTypeSchema, row.sourceType, "other"),
    content: row.content,
    uploadedByUserId: row.uploadedByUserId,
    uploaderRole: decodeNullableEnum(projectRoleSchema, row.uploaderRole),
    sourceProvenance: decodeEnum(
      sourceProvenanceSchema,
      row.sourceProvenance,
      "manual_transcription",
    ),
    sourceTimestamp: row.sourceTimestamp,
    checksumHash: row.checksumHash,
    validationStatus: decodeEnum(validationStatusSchema, row.validationStatus, "pending"),
    validatedByUserId: row.validatedByUserId,
    validatedAt: row.validatedAt,
    validationNotes: row.validationNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toSourceDocumentWithUploader(
  row: Rows.SourceDocument & {
    uploadedBy: Rows.User | null;
    validatedBy: Rows.User | null;
  },
): Domain.SourceDocumentWithUploader {
  return {
    ...toSourceDocument(row),
    uploadedBy: row.uploadedBy ? toUser(row.uploadedBy) : null,
    validatedBy: row.validatedBy ? toUser(row.validatedBy) : null,
  };
}

export function toExtractedInsight(
  row: Rows.ExtractedInsight,
): Domain.ExtractedInsight {
  return {
    id: row.id,
    projectId: row.projectId,
    sourceDocumentId: row.sourceDocumentId,
    insightType: decodeEnum(insightTypeSchema, row.insightType, "goal"),
    rawText: row.rawText,
    normalizedText: row.normalizedText,
    confidence: row.confidence,
    status: decodeEnum(insightStatusSchema, row.status, "pending"),
    promotedToType: row.promotedToType,
    promotedToId: row.promotedToId,
    userEdited: row.userEdited,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toStakeholder(row: Rows.Stakeholder): Domain.Stakeholder {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    role: row.role,
    notes: row.notes,
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toActor(row: Rows.Actor): Domain.Actor {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toBusinessGoal(row: Rows.BusinessGoal): Domain.BusinessGoal {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toBusinessRule(row: Rows.BusinessRule): Domain.BusinessRule {
  return {
    id: row.id,
    projectId: row.projectId,
    ruleText: row.ruleText,
    rationale: row.rationale,
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toRequirement(row: Rows.Requirement): Domain.Requirement {
  return {
    id: row.id,
    projectId: row.projectId,
    ref: row.ref,
    title: row.title,
    description: row.description,
    requirementType: decodeEnum(
      requirementTypeSchema,
      row.requirementType,
      "functional",
    ),
    priority: decodeEnum(prioritySchema, row.priority, "medium"),
    status: decodeEnum(requirementStatusSchema, row.status, "draft"),
    owner: row.owner,
    rationale: row.rationale,
    assumptions: decodeStringArray(row.assumptionsJson),
    constraints: decodeStringArray(row.constraintsJson),
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toUseCase(row: Rows.UseCase): Domain.UseCase {
  return {
    id: row.id,
    projectId: row.projectId,
    requirementId: row.requirementId,
    ref: row.ref,
    title: row.title,
    scopeLevel: decodeEnum(scopeLevelSchema, row.scopeLevel, "high_level"),
    primaryActor: row.primaryActor,
    supportingActors: decodeStringArray(row.supportingActorsJson),
    trigger: row.trigger,
    preconditions: decodeStringArray(row.preconditionsJson),
    postconditions: decodeStringArray(row.postconditionsJson),
    mainFlow: decodeStringArray(row.mainFlowJson),
    alternateFlows: decodeFlowBranches(row.alternateFlowsJson),
    exceptionFlows: decodeFlowBranches(row.exceptionFlowsJson),
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAcceptanceCriterion(
  row: Rows.AcceptanceCriterion,
): Domain.AcceptanceCriterion {
  return {
    id: row.id,
    projectId: row.projectId,
    requirementId: row.requirementId,
    ref: row.ref,
    criterionType: decodeEnum(criterionTypeSchema, row.criterionType, "functional"),
    text: row.text,
    testabilityScore: row.testabilityScore,
    sourceRefs: decodeStringArray(row.sourceRefsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDependency(row: Rows.Dependency): Domain.Dependency {
  return {
    id: row.id,
    projectId: row.projectId,
    fromRequirementId: row.fromRequirementId,
    toRequirementId: row.toRequirementId,
    dependencyType: decodeEnum(
      dependencyTypeSchema,
      row.dependencyType,
      "relates_to",
    ),
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function toTraceLink(row: Rows.TraceLink): Domain.TraceLink {
  return {
    id: row.id,
    projectId: row.projectId,
    fromEntityType: decodeEnum(
      entityTypeSchema,
      row.fromEntityType,
      "source_document",
    ),
    fromEntityId: row.fromEntityId,
    toEntityType: decodeEnum(entityTypeSchema, row.toEntityType, "requirement"),
    toEntityId: row.toEntityId,
    linkReason: row.linkReason,
    createdAt: row.createdAt,
  };
}

export function toPackOutput(row: Rows.PackOutput): Domain.PackOutput {
  return {
    id: row.id,
    projectId: row.projectId,
    mode: decodeEnum(analysisModeSchema, row.mode, "BA"),
    title: row.title,
    jsonContent: row.jsonContent,
    markdownContent: row.markdownContent,
    htmlContent: row.htmlContent,
    createdAt: row.createdAt,
  };
}

export function toAiFinding(row: Rows.AiFinding): Domain.AiFinding {
  return {
    id: row.id,
    projectId: row.projectId,
    runId: row.runId,
    severity: decodeEnum(severitySchema, row.severity, "info"),
    entityType: row.entityType,
    entityId: row.entityId,
    title: row.title,
    explanation: row.explanation,
    suggestedFix: row.suggestedFix,
    status: row.status === "dismissed" ? "dismissed" : "open",
    createdAt: row.createdAt,
  };
}
