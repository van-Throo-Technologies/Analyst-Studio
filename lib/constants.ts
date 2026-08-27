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

export const SCOPES = ["in-scope", "out-of-scope"] as const;

// Which analyst pack a requirement belongs in. "both" is the default because a
// requirement usually matters to whoever is reading — only genuinely one-sided
// material (a board-level goal, a field-level validation rule) gets pinned.
export const PACK_VARIANTS = ["ba", "fa", "both"] as const;

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
