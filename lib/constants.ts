// Shared vocabulary for requirements.
//
// Deliberately free of "server-only" and of any import: the editor and the pack
// viewer are Client Components and need these lists, while the extractor needs
// them to constrain the model. Keeping them here means every consumer reads the
// same source instead of drifting apart.

export const REQUIREMENT_TYPES = [
  "Functional",
  "Business",
  "Non-Functional",
  "Data",
  "Integration",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

// What kind of record a row is. Orthogonal to REQUIREMENT_TYPES above, which
// classifies a *feature* as Functional / Business / and so on — a record can be
// a feature that is Functional, or a business rule that is none of those.
//
// Includes "feature": the RuleBase model's comment lists only the child kinds,
// but features are seeded into the corpus too and must be retrievable. The
// extraction script, the rules API and the UI all read this list, so a kind
// added here becomes queryable everywhere at once.
export const RECORD_TYPES = [
  "feature",
  "business-rule",
  "regulatory-constraint",
  "use-case",
  "acceptance-criteria",
] as const;

export const RECORD_TYPE_LABELS: Record<string, string> = {
  feature: "Feature",
  "business-rule": "Business Rule",
  "regulatory-constraint": "Regulatory Constraint",
  "use-case": "Use Case",
  "acceptance-criteria": "Acceptance Criterion",
};

export type RecordType = (typeof RECORD_TYPES)[number];

export const SCOPES = ["in-scope", "out-of-scope"] as const;

// Which analyst pack a requirement belongs in. "both" is the default because a
// requirement usually matters to whoever is reading — only genuinely one-sided
// material (a board-level goal, a field-level validation rule) gets pinned.
export const PACK_VARIANTS = ["ba", "fa", "both"] as const;

// The industry a project belongs to. Chosen at creation and read later by
// extraction, quality rules and compliance checks — so the stored value is the
// stable slug and the label is presentation only. Renaming a label is safe;
// renaming a slug is a migration.
export const INDUSTRIES = [
  "software-saas",
  "financial-services",
  "healthcare",
  "ecommerce",
  "manufacturing",
] as const;

export const INDUSTRY_LABELS: Record<string, string> = {
  "software-saas": "Software / SaaS",
  "financial-services": "Financial Services",
  healthcare: "Healthcare",
  ecommerce: "E-Commerce",
  manufacturing: "Manufacturing",
};

export const DEFAULT_INDUSTRY = "software-saas";

export type Industry = (typeof INDUSTRIES)[number];

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Scope = (typeof SCOPES)[number];
export type PackVariant = (typeof PACK_VARIANTS)[number];

export const SCOPE_LABELS: Record<string, string> = {
  "in-scope": "In scope",
  "out-of-scope": "Out of scope",
};

export const PACK_LABELS: Record<string, string> = {
  ba: "BA only",
  fa: "FA only",
  both: "Both packs",
};
