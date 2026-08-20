import type { PromptDefinition } from "@/lib/prompts";
import { modeGuidance } from "@/lib/prompts";
import type { AnalysisMode } from "@/lib/schemas/enums";

export type PackNarrativeInput = {
  mode: AnalysisMode;
  goals: string[];
  stakeholders: string[];
  actors: string[];
  rules: string[];
  requirements: { ref: string; title: string; type: string; priority: string }[];
  useCases: { ref: string; title: string; scopeLevel: string }[];
  assumptions: string[];
  constraints: string[];
  risks: string[];
  unreviewedCount: number;
};

/**
 * Job 6 — pack narrative.
 *
 * The model writes only the connective prose. Every list in a pack is assembled
 * from entities by /lib/pack-builders/assemble.ts, so this prompt is explicit
 * that re-listing them is not the job — a narrative that restates the
 * requirements table is both wasted tokens and a second, divergent copy of the
 * truth.
 */
export const packNarrativePrompt: PromptDefinition<PackNarrativeInput> = {
  id: "pack-narrative",
  version: "1.0.0",
  label: "Pack narrative",

  system: (ctx) =>
    [
      "<task>",
      `Write the narrative sections of a ${ctx.mode} pack. You are given a summary of the`,
      "requirement model for context. Everything in that model is already rendered into the pack",
      "by the application, verbatim, with its reference codes.",
      "</task>",
      "",
      modeGuidance(ctx.mode),
      "",
      "<critical>",
      "Do NOT list, enumerate, or restate the requirements, use cases, business rules,",
      "acceptance criteria, risks, assumptions or constraints. They already appear in full,",
      "in their own sections. Your prose sits above them and explains what they add up to.",
      "A narrative that re-lists the model is a defect: it duplicates content and creates a",
      "second version that will drift the moment someone edits a requirement.",
      "",
      "Refer to items by their ref (REQ-003, UC-002) when you need to point at one. Never",
      "paraphrase an item's wording — the reader can see the original a page later, and any",
      "difference between your version and theirs will read as a contradiction.",
      "</critical>",
      "",
      ctx.mode === "BA" ? BA_SECTIONS : FA_SECTIONS,
      "",
      "<voice>",
      "Write as the analyst who did this work, addressing the person who has to act on it.",
      "Direct, specific, professional. No preamble ('This document outlines…'), no throat-clearing,",
      "no marketing language. Each section earns its place or is short.",
      "",
      "Where the model is thin, say so plainly rather than writing around it. 'No non-functional",
      "requirements have been captured; performance and availability expectations are still open'",
      "is useful. Filler that implies the analysis is more complete than it is, is not.",
      "</voice>",
    ].join("\n"),

  user: (input) =>
    [
      `Write the ${input.mode} narrative sections from this model summary.`,
      "",
      list("Business goals", input.goals),
      list("Stakeholders", input.stakeholders),
      list("Actors", input.actors),
      list(
        "Requirements",
        input.requirements.map(
          (r) => `${r.ref} [${r.type}, ${r.priority}] ${r.title}`,
        ),
      ),
      list(
        "Use cases",
        input.useCases.map((u) => `${u.ref} [${u.scopeLevel}] ${u.title}`),
      ),
      list("Business rules", input.rules),
      list("Assumptions", input.assumptions),
      list("Constraints", input.constraints),
      list("Risks", input.risks),
      input.unreviewedCount > 0
        ? `\n<review_state>${input.unreviewedCount} extracted insights have not yet been reviewed by the analyst. Note this in the open questions.</review_state>`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
};

const BA_SECTIONS = [
  "<sections>",
  "overview: 2-4 sentences. What this piece of work is, who it is for, and what the pack covers.",
  "  Orients a reader who has never heard of the project.",
  "",
  "businessProblem: 1-2 paragraphs. The problem in business terms — what is happening today, what",
  "  it costs, and why it is worth solving now. Ground it in the evidence in the model: volumes,",
  "  delays, obligations, stated pain. Do not propose a solution here.",
  "",
  "scope.summary: 2-3 sentences framing what this analysis covers and, importantly, what it",
  "  deliberately does not. Boundaries prevent the most expensive kind of misunderstanding.",
  "scope.inScope: the capability areas this analysis covers. Areas, not individual requirements.",
  "scope.outOfScope: what is explicitly excluded. Only include exclusions supported by the model —",
  "  a stated deferral, an unresolved question, an out-of-scope note. Do not invent exclusions.",
  "",
  "openQuestions: decisions still open, contradictions between stakeholders, and information",
  "  needed before this can be signed off. Be specific: name who disagreed about what, or exactly",
  "  which decision has not been made. An empty array is correct if nothing is genuinely open.",
  "</sections>",
].join("\n");

const FA_SECTIONS = [
  "<sections>",
  "overview: 2-4 sentences. What is being specified and for whom. Assume the business case is",
  "  already agreed — this reader is going to build it.",
  "",
  "functionalScope: 1-2 paragraphs. What the solution must do, at the level of capability areas,",
  "  and where the boundaries of this specification sit — what it covers, what a neighbouring",
  "  system or later phase covers. Reference requirement refs where it helps locate a boundary.",
  "",
  "dataValidationConsiderations: the data and validation concerns a delivery team must resolve —",
  "  mandatory fields, formats, referential integrity, duplicate handling, retention obligations,",
  "  data quality risks. Derive from the requirements, rules and constraints given. One per entry,",
  "  concrete. Empty array if the model genuinely gives nothing to say.",
  "",
  "nonFunctionalConsiderations: performance, availability, security, accessibility, retention and",
  "  operability concerns. Include any non-functional requirement in the model, and name the gaps",
  "  where an obvious concern has no requirement covering it — those gaps are the useful part.",
  "",
  "openQuestions: decisions still open, contradictions, and information needed before build can",
  "  start. Be specific. An empty array is correct if nothing is genuinely open.",
  "</sections>",
].join("\n");

function list(label: string, items: string[]): string {
  const tag = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (items.length === 0) return `<${tag}>none recorded</${tag}>`;
  return [`<${tag}>`, ...items.map((i) => `- ${i}`), `</${tag}>`].join("\n");
}
