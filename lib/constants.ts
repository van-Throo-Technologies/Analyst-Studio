// Shared vocabulary for requirements.
//
// Deliberately free of "server-only" and of any import: the editor is a Client
// Component and needs these lists to build its dropdowns, while the extractor
// needs them to constrain the model. Keeping them here means both read the same
// source instead of drifting apart.

export const REQUIREMENT_TYPES = [
  "Functional",
  "Business",
  "Non-Functional",
  "Data",
  "Integration",
] as const;

export const PRIORITIES = ["High", "Medium", "Low"] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
