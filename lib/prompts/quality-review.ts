import type { PromptDefinition } from "@/lib/prompts";
import { modeGuidance } from "@/lib/prompts";
import type { AnalysisMode } from "@/lib/schemas/enums";

export type QualityReviewInput = {
  mode: AnalysisMode;
  requirements: {
    ref: string;
    title: string;
    description: string;
    type: string;
    priority: string;
  }[];
  useCases: {
    ref: string;
    title: string;
    scopeLevel: string;
    primaryActor: string;
    trigger: string;
    mainFlow: string[];
    alternateFlows: string[];
    exceptionFlows: string[];
    realises: string;
  }[];
  criteria: { ref: string; text: string; verifies: string }[];
  rules: string[];
  goals: string[];
  stakeholders: string[];
  actors: string[];
  assumptions: string[];
  constraints: string[];
  /** Findings the deterministic engine has already raised, so the AI does not repeat them. */
  alreadyFlagged: string[];
};

/**
 * Job 5 — AI quality review.
 *
 * The deterministic engine has already run and its findings are passed in.
 * This prompt is explicitly scoped to what a checklist cannot see: ambiguity,
 * inconsistency between items, missing coverage, and framing that is wrong for
 * the mode. Telling the model what has already been caught is what stops the
 * output being a restatement of the checklist.
 */
export const qualityReviewPrompt: PromptDefinition<QualityReviewInput> = {
  id: "quality-review",
  version: "1.0.0",
  label: "Quality review",

  system: (ctx) =>
    [
      "<task>",
      "Review this requirement model as an experienced analyst would review a colleague's work",
      "before it goes to a client. Find the problems that a mechanical checker cannot.",
      "</task>",
      "",
      modeGuidance(ctx.mode),
      "",
      "<what_to_look_for>",
      "- Ambiguity: wording that two competent readers would implement differently.",
      "- Inconsistency: two items that cannot both be true, or that use the same term to mean",
      "  different things. Name both items.",
      "- Incompleteness: a requirement whose description leaves an obvious question unanswered.",
      "- Missing edge cases: a flow with no failure path, a rule with no stated exception handling,",
      "  a boundary condition nobody has considered.",
      "- Missing actors: someone who plainly interacts with this and appears nowhere.",
      "- Wrong framing for the mode: in BA mode, a requirement written as an implementation;",
      "  in FA mode, a requirement so abstract it cannot be built from.",
      "- Weak acceptance criteria: criteria that restate the requirement instead of defining how",
      "  you would know it was met.",
      "- Conflicting assumptions or constraints: an assumption that a constraint contradicts.",
      "</what_to_look_for>",
      "",
      "<rules>",
      "- Do not repeat anything in the already_flagged list. Those are covered.",
      "- entityType is one of: requirement, use_case, acceptance_criterion, business_rule,",
      "  business_goal, stakeholder, actor, or project for whole-model findings.",
      "- entityRef is the ref shown in the input (REQ-001, UC-002, AC-003). For a business rule,",
      "  goal, stakeholder or actor use its exact name or text. For a project-level finding use",
      "  an empty string.",
      "- severity: 'critical' means the pack would be wrong or unusable if shipped as is;",
      "  'warning' means a reviewer would send it back; 'info' means worth knowing.",
      "  Reserve critical for real defects. A model where everything is critical tells nobody anything.",
      "- explanation says what is wrong and why it matters downstream — what goes wrong in delivery,",
      "  testing or sign-off if this is left as is. Not a restatement of the item.",
      "- suggestedFix is concrete and actionable: what to change it to, or what to go and find out.",
      "  Not 'clarify this'.",
      "- Aim for the findings that matter. Ten sharp findings beat forty generic ones. If the model",
      "  is genuinely in good shape, return few findings — do not pad.",
      "</rules>",
    ].join("\n"),

  user: (input) => {
    const sections: string[] = [];

    sections.push(
      section(
        "requirements",
        input.requirements.map(
          (r) =>
            `${r.ref} [${r.type}, ${r.priority}] ${r.title}\n    ${r.description || "(no description)"}`,
        ),
      ),
    );

    sections.push(
      section(
        "use_cases",
        input.useCases.map((u) =>
          [
            `${u.ref} [${u.scopeLevel}] ${u.title} (realises ${u.realises || "nothing"})`,
            `    actor: ${u.primaryActor || "(none)"} | trigger: ${u.trigger || "(none)"}`,
            u.mainFlow.length > 0 ? `    main: ${u.mainFlow.join(" → ")}` : "    main: (none)",
            u.alternateFlows.length > 0 ? `    alternate: ${u.alternateFlows.join(" | ")}` : "",
            u.exceptionFlows.length > 0 ? `    exception: ${u.exceptionFlows.join(" | ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ),
    );

    sections.push(
      section(
        "acceptance_criteria",
        input.criteria.map((c) => `${c.ref} (verifies ${c.verifies || "nothing"}) ${c.text}`),
      ),
    );

    sections.push(section("business_rules", input.rules));
    sections.push(section("business_goals", input.goals));
    sections.push(section("stakeholders", input.stakeholders));
    sections.push(section("actors", input.actors));
    sections.push(section("assumptions", input.assumptions));
    sections.push(section("constraints", input.constraints));
    sections.push(section("already_flagged", input.alreadyFlagged));

    return [
      `Review this ${input.mode} model and report what a mechanical checker would miss.`,
      "",
      ...sections,
    ].join("\n\n");
  },
};

function section(name: string, items: string[]): string {
  if (items.length === 0) return `<${name}>none</${name}>`;
  return [`<${name}>`, ...items.map((i) => `- ${i}`), `</${name}>`].join("\n");
}
