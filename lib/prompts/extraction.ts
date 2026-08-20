import type { PromptDefinition, PromptContext } from "@/lib/prompts";
import {
  INDUSTRY_LABELS,
  JURISDICTION_LABELS,
  REGULATORY_SENSITIVITY_LABELS,
  SOURCE_PROVENANCE_LABELS,
  SOURCE_TYPE_LABELS,
  type ScenarioType,
  type SourceProvenance,
  type SourceType,
} from "@/lib/schemas/enums";

export type ExtractionInput = {
  sources: {
    title: string;
    sourceType: SourceType;
    provenance: SourceProvenance;
    /** When the material was written in its origin system, if known. */
    sourceTimestamp: Date | null;
    content: string;
  }[];
};

/**
 * Confidence floors, by scenario.
 *
 * Greenfield material is first-hand and current, so an insight the source does
 * not clearly support is usually a misreading and is not worth an analyst's
 * time. Brownfield material is reconstructed from whatever survived — holding
 * it to the same floor throws away the only record that exists. The floors are
 * exported because the deterministic gates enforce afterwards what the prompt
 * asks for, and the two must not drift.
 */
export const CONFIDENCE_FLOORS: Record<
  ScenarioType,
  { default: number; assumption: number }
> = {
  greenfield: { default: 0.7, assumption: 0.6 },
  brownfield: { default: 0.5, assumption: 0.4 },
};

/**
 * Job 1 — source extraction.
 *
 * The output of this job is reviewed by a human before it becomes anything, so
 * the prompt optimises for recall and honesty over polish: capture what the
 * source actually says, keep the verbatim span, and be explicit about
 * confidence rather than quietly guessing.
 *
 * Two variants, chosen by the project's scenario type. They differ in what the
 * material *is* — first-hand and current, or partial and possibly stale — not
 * in what counts as a good insight. Brownfield additionally asks for
 * `contextGap` and `changeRisk`, because on reconstructed material "this is
 * only half the story" and "this needs the organisation to change" are the two
 * things an analyst most needs flagged and least reliably spots alone.
 */
export const extractionPrompt: PromptDefinition<ExtractionInput> = {
  id: "source-extraction",
  // 2.0.0: scenario-aware variants, structured domain context in the framing,
  // per-scenario confidence floors, and the brownfield contextGap/changeRisk
  // flags. Output shape changed, hence the major bump.
  version: "2.0.0",
  label: "Source extraction",

  system: (ctx) => {
    const brownfield = ctx.project.scenarioType === "brownfield";
    const floors = CONFIDENCE_FLOORS[ctx.project.scenarioType];

    return [
      "<task>",
      brownfield
        ? "You are documenting an existing, mature initiative after the fact. Read the sources below and extract structured insights from them. The material is fragmentary: exports, snapshots and second-hand write-ups of decisions taken long ago, by people who may have left. Extract what survives rather than waiting for material that will never arrive."
        : "Read the discovery sources below and extract structured insights from them. The material is first-hand and current — notes and recordings from the people doing the work.",
      "This is the first pass over raw material. An analyst will review, edit and accept",
      "every item you produce, so completeness matters more than elegance.",
      "</task>",
      "",
      domainFraming(ctx),
      "",
      "<insight_types>",
      "Classify each insight as exactly one of:",
      "- stakeholder: a named person, role or group with an interest in the outcome.",
      "- actor: someone or something that interacts with the solution. A person can be both;",
      "  emit both if the source supports it. Include system actors and external parties.",
      "- goal: a business outcome someone wants. Not a feature — the result the feature serves.",
      "- business_rule: a constraint on how the business operates, that holds regardless of",
      "  the solution. Policies, thresholds, mandatory routings, regulatory obligations.",
      "- assumption: something being treated as true but not established by the sources.",
      "- constraint: a fixed limitation on the solution. Technology, budget, timeline, legal,",
      "  organisational.",
      "- risk: something that could prevent the goal being met, or cause harm if it occurs.",
      "- requirement_candidate: a capability the solution appears to need. Phrase as a capability,",
      "  not as a screen or a technology.",
      "</insight_types>",
      "",
      "<rules>",
      "- rawText must be a verbatim span copied from the source, long enough to stand on its own",
      "  when read out of context. Never paraphrase in rawText.",
      "- normalizedText is one clean, self-contained sentence in your own words. It must make",
      "  sense to someone who has not read the source. Resolve pronouns and shorthand.",
      "- confidence reflects how directly the source supports the insight, not how important it is:",
      "  0.9-1.0 the source states it outright; 0.6-0.8 it is clearly implied;",
      "  0.3-0.5 it is a reasonable reading but the source is loose.",
      `- Do not emit an insight below ${floors.default} confidence, or below ${floors.assumption} for an assumption.`,
      brownfield
        ? "  These floors are deliberately low. Reconstructed material rarely states anything outright, and a flagged uncertain insight is worth more to the analyst than a silent omission."
        : "  These floors are deliberately high. First-hand material that only weakly supports a reading usually means the reading is wrong.",
      "- Extract the same point once. If two sources say the same thing, emit the stronger one.",
      "- Do not extract pleasantries, scheduling, or meeting logistics.",
      "- Where a source uses a vague qualifier, keep the qualifier in rawText but make",
      "  normalizedText name it as unquantified — for example 'The portal should be easy to use;",
      "  no usability measure has been defined.'",
      "- Where two sources conflict, extract both and let normalizedText state the conflict.",
      "</rules>",
      "",
      "<flags>",
      brownfield
        ? [
            "Set contextGap to true when the source does not carry enough around the insight to act on it:",
            "a decision recorded without its reasoning, a rule with no stated scope, a reference to a",
            "conversation or document that is not here. This is the normal case in reconstructed material",
            "— flag it rather than filling the gap yourself.",
            "",
            "Set changeRisk to true when acting on the insight would require people to work differently:",
            "a role that must be created or absorbed, a handover that moves between teams, a manual step",
            "someone currently owns that disappears. Technical difficulty is not change risk;",
            "organisational disruption is.",
          ].join("\n")
        : [
            "Set contextGap and changeRisk to false on every insight. This project's material is",
            "first-hand and current, and these flags exist for reconstructed material where the",
            "surrounding context is genuinely missing.",
          ].join("\n"),
      "</flags>",
      "",
      "<unresolved>",
      "Separately, list questions the sources raise but do not answer, and contradictions between",
      "sources. These are the things an analyst would put on a follow-up list. Be specific: name",
      "who disagreed about what, or exactly which decision is still open.",
      "</unresolved>",
    ].join("\n");
  },

  user: (input) => {
    const blocks = input.sources.map((source, index) =>
      [
        `<source index="${index + 1}" type="${SOURCE_TYPE_LABELS[source.sourceType]}" origin="${SOURCE_PROVENANCE_LABELS[source.provenance]}"${
          source.sourceTimestamp
            ? ` written="${source.sourceTimestamp.toISOString().slice(0, 10)}"`
            : ""
        }>`,
        `<title>${source.title}</title>`,
        "<content>",
        source.content,
        "</content>",
        "</source>",
      ].join("\n"),
    );

    return [
      `Extract insights from the following ${input.sources.length} source${input.sources.length === 1 ? "" : "s"}.`,
      "The origin attribute says how the material reached us. Weigh a Confluence snapshot or a",
      "Jira export differently from notes taken in the room, and say so in normalizedText where",
      "it changes how much the insight can be relied on.",
      "",
      blocks.join("\n\n"),
    ].join("\n");
  },
};

/**
 * The project's structured domain context, as prompt text.
 *
 * `projectFraming` in the registry carries the free-text fields that every job
 * needs. This adds the columns that only matter once the model is reading raw
 * material: industry vocabulary to preserve, and the regulatory setting that
 * decides whether an offhand remark about retention is a passing comment or a
 * business rule.
 */
function domainFraming(ctx: PromptContext): string {
  const p = ctx.project;
  const lines = ["<domain>"];

  lines.push(`Industry: ${INDUSTRY_LABELS[p.industry]}`);
  if (p.subdomain?.trim()) lines.push(`Subdomain: ${p.subdomain.trim()}`);
  if (p.jurisdiction) lines.push(`Jurisdiction: ${JURISDICTION_LABELS[p.jurisdiction]}`);
  lines.push(
    `Regulatory sensitivity: ${REGULATORY_SENSITIVITY_LABELS[p.regulatorySensitivity]}`,
  );
  if (p.solutionDomain?.trim()) {
    lines.push(`Solution domain: ${p.solutionDomain.trim()}`);
  }

  if (p.regulatorySensitivity === "high") {
    lines.push(
      "",
      "This work is audited. Treat anything touching retention, consent, access, attribution or",
      "reporting as a business rule worth extracting even when it is said in passing — in this",
      "setting an offhand remark about record-keeping is an obligation, not small talk.",
    );
  }

  lines.push("</domain>");
  return lines.join("\n");
}
