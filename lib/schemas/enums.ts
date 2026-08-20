import { z } from "zod";

/**
 * SQLite has no native enums, so every enum-like column is a String in Prisma.
 * These Zod enums are the single source of truth and are enforced at every
 * application boundary (forms, server actions, AI output parsing).
 *
 * Each enum also exports a `*_LABELS` map so the UI never hand-writes display
 * strings, and label drift between screens is impossible.
 */

export const analysisModeSchema = z.enum(["BA", "FA"]);
export type AnalysisMode = z.infer<typeof analysisModeSchema>;

export const ANALYSIS_MODE_LABELS: Record<AnalysisMode, string> = {
  BA: "Business Analysis",
  FA: "Functional Analysis",
};

/**
 * Industry. Drives what an analyst should be probing for and, from Phase 3,
 * which domain knowledge is attached to extraction and quality checks.
 * "other" is the honest default — a wrong industry is worse than none.
 */
export const industrySchema = z.enum([
  "banking",
  "insurance",
  "healthcare",
  "public_sector",
  "education",
  "hr",
  "recruitment",
  "retail",
  "e_commerce",
  "logistics",
  "manufacturing",
  "SaaS",
  "telecommunications",
  "other",
]);
export type Industry = z.infer<typeof industrySchema>;

export const INDUSTRY_LABELS: Record<Industry, string> = {
  banking: "Banking",
  insurance: "Insurance",
  healthcare: "Healthcare",
  public_sector: "Public sector",
  education: "Education",
  hr: "HR",
  recruitment: "Recruitment",
  retail: "Retail",
  e_commerce: "E-commerce",
  logistics: "Logistics",
  manufacturing: "Manufacturing",
  SaaS: "SaaS",
  telecommunications: "Telecommunications",
  other: "Other / not listed",
};

/** Alphabetical for the dropdown, with "other" pinned last. */
export const INDUSTRY_ORDER: Industry[] = [
  ...industrySchema.options
    .filter((value) => value !== "other")
    .sort((a, b) => INDUSTRY_LABELS[a].localeCompare(INDUSTRY_LABELS[b])),
  "other",
];

export const regulatorySensitivitySchema = z.enum(["low", "medium", "high"]);
export type RegulatorySensitivity = z.infer<typeof regulatorySensitivitySchema>;

export const REGULATORY_SENSITIVITY_LABELS: Record<RegulatorySensitivity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Shown under each option so the choice is made on meaning, not on a word. */
export const REGULATORY_SENSITIVITY_HINTS: Record<RegulatorySensitivity, string> = {
  low: "No specific regime applies beyond ordinary data protection.",
  medium: "A regime applies and shapes some requirements, but the work is not audited against it.",
  high: "Audited or supervised. Traceability and evidence are themselves deliverables.",
};

/**
 * Jurisdiction. A short list rather than every country — it exists to signal
 * which regimes are in play, not to be a location field.
 */
export const jurisdictionSchema = z.enum([
  "eu",
  "belgium",
  "uk",
  "us",
  "global",
  "other",
]);
export type Jurisdiction = z.infer<typeof jurisdictionSchema>;

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  eu: "EU",
  belgium: "Belgium",
  uk: "UK",
  us: "US",
  global: "Global",
  other: "Other",
};

/**
 * A user's role on one project. Roles are per project, not global — the same
 * person is routinely the BA on one engagement and a reviewer on another.
 *
 * Stored uppercase because that is how these are spoken about on an engagement,
 * and because the spec fixes them; every other enum here is lowercase.
 */
export const projectRoleSchema = z.enum([
  "OWNER",
  "PM",
  "BA",
  "FA",
  "ARCHITECT",
  "REVIEWER",
]);
export type ProjectRole = z.infer<typeof projectRoleSchema>;

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: "Owner",
  PM: "Project manager",
  BA: "Business analyst",
  FA: "Functional analyst",
  ARCHITECT: "Architect",
  REVIEWER: "Reviewer",
};

export const PROJECT_ROLE_HINTS: Record<ProjectRole, string> = {
  OWNER: "Full control, including deleting the project and managing access.",
  PM: "Manages project settings and sources.",
  BA: "Adds sources and builds the business analysis.",
  FA: "Adds sources and builds the functional analysis.",
  ARCHITECT: "Adds sources and contributes technical context.",
  REVIEWER: "Read-only. Can see everything, can change nothing.",
};

/**
 * Greenfield vs brownfield changes what good intake looks like: a greenfield
 * project is fed by the team as work happens, a brownfield one is reconstructed
 * afterwards from whatever survived in Confluence, Jira and inboxes.
 */
export const scenarioTypeSchema = z.enum(["greenfield", "brownfield"]);
export type ScenarioType = z.infer<typeof scenarioTypeSchema>;

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  greenfield: "Greenfield",
  brownfield: "Brownfield",
};

export const SCENARIO_TYPE_DESCRIPTIONS: Record<ScenarioType, string> = {
  greenfield:
    "New work. Sources arrive as it happens, from the people doing it, and hand off cleanly.",
  brownfield:
    "Existing work being documented after the fact. Sources are partial and second-hand — exports from Confluence, Jira tickets, SharePoint documents of uncertain vintage.",
};

export const projectStatusSchema = z.enum([
  "draft",
  "in_analysis",
  "review",
  "delivered",
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  in_analysis: "In analysis",
  review: "In review",
  delivered: "Delivered",
};

export const sourceTypeSchema = z.enum([
  "workshop_notes",
  "transcript",
  "email",
  "feature_brief",
  "existing_requirements",
  "other",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  workshop_notes: "Workshop notes",
  transcript: "Transcript",
  email: "Email",
  feature_brief: "Feature brief",
  existing_requirements: "Existing requirements",
  other: "Other",
};

/**
 * Where the material came from, as opposed to what kind of document it is.
 *
 * `sourceType` answers "what am I reading" (a transcript, a feature brief);
 * provenance answers "how did it reach us", which is what decides how much
 * weight it carries. A workshop's own notes and a Confluence page summarising
 * that workshop months later can be the same source type and are not the same
 * evidence — brownfield projects live on the difference.
 *
 * Two values overlap with `sourceTypeSchema` by name ("workshop_notes",
 * "email") because the origin genuinely is the artefact in those cases: notes
 * taken in the room, a mail thread forwarded as-is.
 */
export const sourceProvenanceSchema = z.enum([
  "workshop_notes",
  "jira_export",
  "confluence_snapshot",
  "email",
  "pdf_upload",
  "docx_upload",
  "manual_transcription",
]);
export type SourceProvenance = z.infer<typeof sourceProvenanceSchema>;

export const SOURCE_PROVENANCE_LABELS: Record<SourceProvenance, string> = {
  workshop_notes: "Workshop notes",
  jira_export: "Jira export",
  confluence_snapshot: "Confluence snapshot",
  email: "Email",
  pdf_upload: "PDF upload",
  docx_upload: "DOCX upload",
  manual_transcription: "Manual transcription",
};

/** Shown under the choice, so provenance is picked on meaning, not on a word. */
export const SOURCE_PROVENANCE_HINTS: Record<SourceProvenance, string> = {
  workshop_notes: "Written in the room, by someone who was there.",
  jira_export: "Exported from Jira. Reflects the ticket, not necessarily the decision behind it.",
  confluence_snapshot: "Copied from a Confluence page of uncertain vintage — may already be stale.",
  email: "A mail thread, forwarded or pasted as-is.",
  pdf_upload: "Converted from an uploaded PDF. Layout is lost; check tables and columns read correctly.",
  docx_upload: "Converted from an uploaded Word document. Tracked changes and comments do not survive.",
  manual_transcription: "Typed up or pasted by hand from another medium. Wording is second-hand.",
};

/**
 * Whether a human has confirmed this source is a faithful record of its origin.
 *
 * Deliberately about the *material*, not the analysis: validating says "this is
 * what was actually said", not "this is correct" or "we agree with it". A
 * rejected source is kept, not deleted — knowing a document was found
 * unreliable is itself worth having, and anything already extracted from it
 * still needs to trace somewhere.
 */
export const validationStatusSchema = z.enum(["pending", "validated", "rejected"]);
export type ValidationStatus = z.infer<typeof validationStatusSchema>;

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  pending: "Not validated",
  validated: "Validated",
  rejected: "Rejected",
};

export const VALIDATION_STATUS_HINTS: Record<ValidationStatus, string> = {
  pending: "Nobody has confirmed this is a faithful record of its origin yet.",
  validated: "Confirmed as a faithful record of what the origin actually said.",
  rejected: "Found unreliable. Kept for the record; treat anything drawn from it with care.",
};

export const insightTypeSchema = z.enum([
  "stakeholder",
  "actor",
  "goal",
  "business_rule",
  "assumption",
  "constraint",
  "risk",
  "requirement_candidate",
]);
export type InsightType = z.infer<typeof insightTypeSchema>;

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  stakeholder: "Stakeholders",
  actor: "Actors",
  goal: "Goals",
  business_rule: "Business rules",
  assumption: "Assumptions",
  constraint: "Constraints",
  risk: "Risks",
  requirement_candidate: "Candidate requirements",
};

/** Display order for the extraction review screen. */
export const INSIGHT_TYPE_ORDER: InsightType[] = [
  "stakeholder",
  "actor",
  "goal",
  "business_rule",
  "assumption",
  "constraint",
  "risk",
  "requirement_candidate",
];

export const insightStatusSchema = z.enum([
  "pending",
  "accepted",
  "dismissed",
  "promoted",
]);
export type InsightStatus = z.infer<typeof insightStatusSchema>;

export const INSIGHT_STATUS_LABELS: Record<InsightStatus, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  dismissed: "Dismissed",
  promoted: "Promoted",
};

export const requirementTypeSchema = z.enum([
  "business",
  "functional",
  "non_functional",
]);
export type RequirementType = z.infer<typeof requirementTypeSchema>;

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  business: "Business",
  functional: "Functional",
  non_functional: "Non-functional",
};

export const requirementStatusSchema = z.enum(["draft", "reviewed", "approved"]);
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  approved: "Approved",
};

export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Priority = z.infer<typeof prioritySchema>;

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const scopeLevelSchema = z.enum(["high_level", "detailed"]);
export type ScopeLevel = z.infer<typeof scopeLevelSchema>;

export const SCOPE_LEVEL_LABELS: Record<ScopeLevel, string> = {
  high_level: "High level",
  detailed: "Detailed",
};

export const criterionTypeSchema = z.enum([
  "business",
  "functional",
  "non_functional",
]);
export type CriterionType = z.infer<typeof criterionTypeSchema>;

export const CRITERION_TYPE_LABELS: Record<CriterionType, string> = {
  business: "Business",
  functional: "Functional",
  non_functional: "Non-functional",
};

export const dependencyTypeSchema = z.enum([
  "blocks",
  "relates_to",
  "depends_on",
  "conflicts_with",
]);
export type DependencyType = z.infer<typeof dependencyTypeSchema>;

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  blocks: "Blocks",
  relates_to: "Relates to",
  depends_on: "Depends on",
  conflicts_with: "Conflicts with",
};

export const entityTypeSchema = z.enum([
  "source_document",
  "extracted_insight",
  "stakeholder",
  "actor",
  "business_goal",
  "business_rule",
  "requirement",
  "use_case",
  "acceptance_criterion",
  "pack_section",
]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  source_document: "Source",
  extracted_insight: "Insight",
  stakeholder: "Stakeholder",
  actor: "Actor",
  business_goal: "Business goal",
  business_rule: "Business rule",
  requirement: "Requirement",
  use_case: "Use case",
  acceptance_criterion: "Acceptance criterion",
  pack_section: "Pack section",
};

export const severitySchema = z.enum(["info", "warning", "critical"]);
export type Severity = z.infer<typeof severitySchema>;

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const auditActionSchema = z.enum([
  "created",
  "settings_changed",
  "status_changed",
  "archived",
  "source_added",
  "source_updated",
  "source_deleted",
  "source_validated",
  "source_rejected",
  "source_validation_reset",
  "source_extraction_completed",
  "access_granted",
  "access_revoked",
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  created: "Project created",
  settings_changed: "Settings changed",
  status_changed: "Status changed",
  archived: "Archived",
  source_added: "Source added",
  source_updated: "Source edited",
  source_deleted: "Source deleted",
  source_validated: "Source validated",
  source_rejected: "Source rejected",
  source_validation_reset: "Source validation reset",
  source_extraction_completed: "Extraction run",
  access_granted: "Access granted",
  access_revoked: "Access revoked",
};

export const aiJobSchema = z.enum([
  "source_extraction",
  "requirement_drafting",
  "use_case_drafting",
  "acceptance_criteria_drafting",
  "quality_review",
  "pack_generation",
]);
export type AiJob = z.infer<typeof aiJobSchema>;

export const AI_JOB_LABELS: Record<AiJob, string> = {
  source_extraction: "Source extraction",
  requirement_drafting: "Requirement drafting",
  use_case_drafting: "Use case drafting",
  acceptance_criteria_drafting: "Acceptance criteria drafting",
  quality_review: "Quality review",
  pack_generation: "Pack generation",
};
