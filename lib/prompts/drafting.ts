import type { PromptDefinition } from "@/lib/prompts";
import { modeGuidance } from "@/lib/prompts";
import type { AnalysisMode } from "@/lib/schemas/enums";

/**
 * Jobs 2, 3 and 4 — requirement, use case and acceptance criteria drafting.
 *
 * All three take accepted, human-reviewed entities as input rather than raw
 * source text. That is the point of the pipeline: by this stage an analyst has
 * already decided what is true, so the model's job is to shape it, not to
 * decide it.
 */

// --- Job 2: requirement drafting -------------------------------------------

export type RequirementDraftingInput = {
  mode: AnalysisMode;
  goals: string[];
  rules: string[];
  actors: string[];
  candidates: { text: string; sourceTitle: string }[];
  assumptions: string[];
  constraints: string[];
  existingTitles: string[];
};

export const requirementDraftingPrompt: PromptDefinition<RequirementDraftingInput> = {
  id: "requirement-drafting",
  version: "1.0.0",
  label: "Requirement drafting",

  system: (ctx) =>
    [
      "<task>",
      "Turn reviewed candidate requirements and supporting context into properly formed requirements.",
      "An analyst has already accepted the inputs below, so do not re-litigate whether they are true.",
      "Your job is to make them precise, atomic and testable.",
      "</task>",
      "",
      modeGuidance(ctx.mode),
      "",
      "<rules>",
      "- One requirement per capability. If a candidate bundles two capabilities, split it.",
      "  Conversely, merge candidates that restate the same capability.",
      "- title: a single line naming the capability. No 'The system shall' prefix — the title is a label.",
      "- description: what must be true, for whom, under what conditions. Precise enough that two",
      "  developers reading it would build the same thing. Use 'must' for obligations.",
      "- requirementType: 'business' for an outcome the business needs regardless of solution;",
      "  'functional' for behaviour the solution must provide; 'non_functional' for a quality",
      "  attribute such as performance, availability, security, accessibility or retention.",
      "- priority: base it on evidence in the inputs — stated urgency, volume, regulatory obligation,",
      "  or dependency on other work. Do not mark everything high. If the inputs give no signal,",
      "  use 'medium'.",
      "- rationale: one line on why this is needed, in business terms.",
      "- assumptions / constraints: only where they specifically apply to this requirement. Do not",
      "  copy the project-wide lists onto every requirement.",
      "- sourceTitles: the exact titles of the source documents supporting this requirement, copied",
      "  verbatim from the inputs. If none apply, return an empty array rather than guessing.",
      "- Never restate a vague qualifier. If a candidate says 'the portal should be fast', either",
      "  quantify it from other inputs or write the requirement as a non-functional one that names",
      "  the missing threshold explicitly.",
      "- Do not produce a requirement that duplicates one of the existing titles listed in the input.",
      "</rules>",
      "",
      "<notes>",
      "Use the notes array for decisions a reviewer should know about: candidates you merged,",
      "candidates you split, and anything you deliberately did not turn into a requirement and why.",
      "</notes>",
    ].join("\n"),

  user: (input) =>
    [
      "Draft requirements from the following reviewed inputs.",
      "",
      list("Business goals", input.goals),
      list("Business rules", input.rules),
      list("Actors", input.actors),
      list("Project assumptions", input.assumptions),
      list("Project constraints", input.constraints),
      "",
      "<candidate_requirements>",
      ...input.candidates.map(
        (c, i) => `${i + 1}. ${c.text}\n   (source: ${c.sourceTitle})`,
      ),
      "</candidate_requirements>",
      "",
      list("Requirements that already exist — do not duplicate these", input.existingTitles),
    ].join("\n"),
};

// --- Job 3: use case drafting ----------------------------------------------

export type UseCaseDraftingInput = {
  mode: AnalysisMode;
  requirement: { ref: string; title: string; description: string; rationale: string };
  actors: string[];
  rules: string[];
  scopeLevel: "high_level" | "detailed";
};

export const useCaseDraftingPrompt: PromptDefinition<UseCaseDraftingInput> = {
  id: "use-case-drafting",
  version: "1.0.0",
  label: "Use case drafting",

  system: (ctx) =>
    [
      "<task>",
      "Draft one use case that realises the given requirement.",
      "</task>",
      "",
      modeGuidance(ctx.mode),
      "",
      "<rules>",
      "- primaryActor must be one of the actors listed in the input where one fits. Only introduce",
      "  a new actor if none of the listed ones can perform this, and say so in the title if you do.",
      "- trigger is the event that starts the flow, not a state. 'The policyholder selects Report a",
      "  claim', not 'The policyholder wants to make a claim'.",
      "- mainFlow steps are numbered implicitly by order. Each step is one action by one party.",
      "  Alternate actor and system steps as the interaction requires. Do not number them yourself.",
      "- Business rules listed in the input constrain the flow. Where a rule applies to a step,",
      "  make the step reflect it rather than restating the rule separately.",
      "</rules>",
      "",
      "<scope_levels>",
      "high_level: the interaction in 4-8 main-flow steps. Preconditions and postconditions where",
      "they are genuinely load-bearing. Alternate and exception flows only for divergences a",
      "stakeholder would care about. Suitable for a BA pack.",
      "",
      "detailed: buildable. Explicit preconditions and postconditions. A complete main flow.",
      "At least one alternate flow and at least one exception flow — every real interaction has a",
      "way to diverge and a way to fail, and if you cannot find one you have not thought hard",
      "enough. Name validation failures, missing data, unavailable dependencies and permission",
      "denials specifically. Suitable for an FA pack.",
      "</scope_levels>",
    ].join("\n"),

  user: (input) =>
    [
      `Draft a ${input.scopeLevel === "detailed" ? "detailed" : "high-level"} use case for this requirement.`,
      "",
      "<requirement>",
      `Ref: ${input.requirement.ref}`,
      `Title: ${input.requirement.title}`,
      `Description: ${input.requirement.description || "(none given)"}`,
      input.requirement.rationale ? `Rationale: ${input.requirement.rationale}` : "",
      "</requirement>",
      "",
      list("Known actors", input.actors),
      list("Business rules that may apply", input.rules),
    ]
      .filter(Boolean)
      .join("\n"),
};

// --- Job 4: acceptance criteria drafting -----------------------------------

export type CriteriaDraftingInput = {
  mode: AnalysisMode;
  requirement: { ref: string; title: string; description: string };
  useCases: { title: string; mainFlow: string[]; exceptionFlows: string[] }[];
  rules: string[];
  existing: string[];
};

export const criteriaDraftingPrompt: PromptDefinition<CriteriaDraftingInput> = {
  id: "acceptance-criteria-drafting",
  version: "1.0.0",
  label: "Acceptance criteria drafting",

  system: (ctx) =>
    [
      "<task>",
      "Draft acceptance criteria that define when the given requirement is satisfied.",
      "</task>",
      "",
      modeGuidance(ctx.mode),
      "",
      "<what_makes_a_criterion_good>",
      "A criterion is good when a tester can mark it pass or fail without interpreting it.",
      "That means: a specific starting condition, a specific action or event, and a specific,",
      "observable outcome. Prefer the 'Given ... when ... then ...' shape; use plain declarative",
      "wording where that reads better, but keep all three parts.",
      "",
      "Never write a criterion containing an unquantified qualifier. If the requirement itself is",
      "vague, write a criterion that names the threshold that has to be agreed — for example",
      "'Acknowledgement is sent within 1 hour of submission' rather than 'Acknowledgement is fast'.",
      "If no threshold can be derived from the inputs, say so explicitly in the criterion text so",
      "the gap is visible rather than papered over.",
      "</what_makes_a_criterion_good>",
      "",
      ctx.mode === "BA"
        ? [
            "<ba_criteria>",
            "Business criteria state outcomes the business can verify: an outcome achieved, a rule",
            "enforced, a boundary respected, a measure met. They are checked against the business,",
            "not against a screen. Mark them criterionType 'business' unless the requirement is",
            "explicitly a quality attribute, in which case use 'non_functional'.",
            "</ba_criteria>",
          ].join("\n")
        : [
            "<fa_criteria>",
            "Functional criteria state system behaviour a tester can execute: input, action, response,",
            "including the failure paths. Cover the main flow and, where use cases are supplied, the",
            "exception flows. Use criterionType 'functional' for behaviour and 'non_functional' for",
            "performance, availability, security, accessibility or retention criteria.",
            "</fa_criteria>",
          ].join("\n"),
      "",
      "<rules>",
      "- Produce between 2 and 6 criteria. Enough to cover the requirement, not so many that each",
      "  is trivial.",
      "- Cover the negative cases, not only the happy path.",
      "- Do not duplicate any criterion already listed in the input.",
      "- Each criterion stands alone. Do not write 'as above' or 'the same but for X'.",
      "</rules>",
    ].join("\n"),

  user: (input) => {
    const useCaseBlocks = input.useCases.map((uc) =>
      [
        `<use_case title="${uc.title}">`,
        uc.mainFlow.length > 0 ? `Main flow: ${uc.mainFlow.join(" → ")}` : "",
        uc.exceptionFlows.length > 0
          ? `Exception flows: ${uc.exceptionFlows.join("; ")}`
          : "",
        "</use_case>",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    return [
      `Draft acceptance criteria for ${input.requirement.ref} in ${input.mode} mode.`,
      "",
      "<requirement>",
      `Title: ${input.requirement.title}`,
      `Description: ${input.requirement.description || "(none given)"}`,
      "</requirement>",
      "",
      useCaseBlocks.length > 0 ? useCaseBlocks.join("\n\n") : "",
      "",
      list("Business rules that may apply", input.rules),
      list("Criteria that already exist — do not duplicate these", input.existing),
    ]
      .filter(Boolean)
      .join("\n");
  },
};

// ---------------------------------------------------------------------------

function list(label: string, items: string[]): string {
  if (items.length === 0) return `<${slug(label)}>none recorded</${slug(label)}>`;
  return [
    `<${slug(label)}>`,
    ...items.map((item) => `- ${item}`),
    `</${slug(label)}>`,
  ].join("\n");
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
