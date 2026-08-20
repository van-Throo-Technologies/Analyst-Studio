import type { AnalysisMode } from "@/lib/schemas/enums";
import type { Project } from "@/lib/schemas/entities";

/**
 * Prompt registry.
 *
 * Every prompt is versioned and lives in code. The version string is written
 * to the AiGeneration row for each run, so six months from now it is possible
 * to ask "which prompt produced this requirement?" and get an answer.
 *
 * Bump the version whenever the wording changes in a way that could change
 * output. Treat the version as part of the output contract, not as a changelog.
 */

export type PromptDefinition<TInput> = {
  readonly id: string;
  readonly version: string;
  readonly label: string;
  readonly system: (ctx: PromptContext) => string;
  readonly user: (input: TInput) => string;
};

export type PromptContext = {
  /**
   * The structured domain columns are part of the contract, not just the free
   * text: a prompt that knows the industry and the regulatory setting reads the
   * same source differently, and Phase 3 extraction depends on it.
   */
  project: Pick<
    Project,
    | "name"
    | "description"
    | "analysisGoal"
    | "domainContext"
    | "industry"
    | "subdomain"
    | "jurisdiction"
    | "regulatorySensitivity"
    | "solutionDomain"
    | "scenarioType"
  >;
  mode: AnalysisMode;
};

/**
 * Shared framing. Prepended to every job so the AI is never asked to reason
 * about this project without knowing what the project is for.
 */
export function analystPersona(): string {
  return [
    "You are an experienced business and functional analyst working inside Analyst Studio,",
    "a structured analysis workspace. You produce reviewable analysis artefacts, not prose essays.",
    "",
    "How you work:",
    "- You are precise and conservative. You do not invent facts that are not in the source material.",
    "- When the sources are ambiguous, contradictory or silent, you say so explicitly rather than",
    "  smoothing it over. Unresolved questions are findings, not failures.",
    "- You distinguish what a stakeholder said from what you inferred.",
    "- You avoid vague qualifiers (fast, easy, user-friendly, efficient, intuitive, seamless,",
    "  robust, scalable) unless the source gives a measurable definition. If a source uses one,",
    "  either quantify it from context or flag it as needing clarification.",
    "- You write in plain professional English. No marketing tone, no filler, no restating the input.",
  ].join("\n");
}

export function projectFraming(ctx: PromptContext): string {
  const lines = [
    "<project_context>",
    `Project: ${ctx.project.name}`,
  ];
  if (ctx.project.description.trim()) {
    lines.push(`Description: ${ctx.project.description.trim()}`);
  }
  if (ctx.project.analysisGoal.trim()) {
    lines.push(`Analysis goal: ${ctx.project.analysisGoal.trim()}`);
  }
  if (ctx.project.domainContext.trim()) {
    lines.push(`Domain and constraints: ${ctx.project.domainContext.trim()}`);
  }
  lines.push(
    `Current output mode: ${ctx.mode} (${ctx.mode === "BA" ? "Business Analysis" : "Functional Analysis"})`,
  );
  lines.push("</project_context>");
  return lines.join("\n");
}

/**
 * What each mode is for. Included in jobs whose output differs by mode, so the
 * mode toggle changes the substance of the output rather than just a heading.
 */
export function modeGuidance(mode: AnalysisMode): string {
  if (mode === "BA") {
    return [
      "<mode_guidance>",
      "Business Analysis mode. The reader is a stakeholder or sponsor deciding whether and why to proceed.",
      "Frame everything in business terms: the problem, who is affected, what outcome must be true,",
      "and what the boundaries and rules are. State capability, not implementation.",
      "Write 'the claim must be acknowledged within one hour of submission', never",
      "'the portal sends an SMTP acknowledgement email via the notification service'.",
      "Solution-specific detail belongs in FA mode, not here.",
      "</mode_guidance>",
    ].join("\n");
  }
  return [
    "<mode_guidance>",
    "Functional Analysis mode. The reader is a delivery team that has to build and test this.",
    "Be specific about system behaviour: triggers, preconditions, main flow, alternate and exception",
    "flows, validations, data rules, dependencies and edge cases. Say what the solution must do and",
    "how it must behave under both normal and abnormal conditions.",
    "Do not restate business justification — that has already been established.",
    "</mode_guidance>",
  ].join("\n");
}

/** Vague words the deterministic quality engine also checks for. Kept in one place. */
export const VAGUE_TERMS = [
  "fast",
  "quick",
  "easy",
  "simple",
  "user-friendly",
  "user friendly",
  "efficient",
  "intuitive",
  "seamless",
  "robust",
  "scalable",
  "flexible",
  "modern",
  "appropriate",
  "as needed",
  "etc",
  "and so on",
  "state of the art",
  "best practice",
  "if possible",
  "where relevant",
] as const;
