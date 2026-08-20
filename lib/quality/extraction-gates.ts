import "server-only";
import { CONFIDENCE_FLOORS } from "@/lib/prompts/extraction";
import type { ExtractedInsightDraft } from "@/lib/ai/schemas";
import type { SourceDocumentWithUploader } from "@/lib/schemas/entities";
import {
  INSIGHT_TYPE_LABELS,
  type ProjectRole,
  type ScenarioType,
  type Severity,
} from "@/lib/schemas/enums";
import { truncate } from "@/lib/utils";

/**
 * Deterministic checks over freshly extracted insights.
 *
 * These run on every extraction, before an analyst sees anything, and they are
 * deliberately mechanical: thresholds, string comparisons, keyword lists. No
 * model is involved, so the same insights always produce the same findings and
 * a finding can always be explained by pointing at a rule.
 *
 * The AI-judged checks a reviewer would also want — does this contradict
 * another insight, is the scope coherent — are Phase 4. Keeping the two apart
 * matters: an analyst can trust these findings absolutely, which is exactly
 * what makes them useful for triage.
 */

/** A finding before it has an id — the caller attaches runId and project. */
export type ExtractionFinding = {
  severity: Severity;
  /** "extracted_insight", or "source_document" for whole-source observations. */
  entityType: string;
  /** Index into the insight array, resolved to a real id after insert. */
  insightIndex: number | null;
  title: string;
  explanation: string;
  suggestedFix: string;
};

export type ExtractionGateInput = {
  insights: ExtractedInsightDraft[];
  source: SourceDocumentWithUploader;
  scenarioType: ScenarioType;
  /** normalizedText of insights already in the project, for duplicate checks. */
  existingTexts: string[];
};

/** Below this, an insight is too terse to review without opening the source. */
const MIN_TEXT_LENGTH = 10;
/** Above this, an insight is usually several insights wearing one coat. */
const MAX_TEXT_LENGTH = 500;
/** Jaccard similarity over word sets. Above this, treat as the same insight. */
const DUPLICATE_SIMILARITY = 0.9;

/**
 * Words that mean a business goal has drifted into solution design. Checked
 * only on goals from a PM's material, where the whole point of the source is to
 * say what the business needs rather than how to build it.
 */
const TECHNICAL_KEYWORDS = [
  "api",
  "database",
  "encryption",
  "latency",
  "endpoint",
  "schema",
  "cache",
  "queue",
  "microservice",
  "sso",
  "webhook",
];

export function runExtractionGates(input: ExtractionGateInput): ExtractionFinding[] {
  const { insights, source, scenarioType, existingTexts } = input;
  const findings: ExtractionFinding[] = [];
  const floors = CONFIDENCE_FLOORS[scenarioType];

  const seen = existingTexts.map(normalise);

  insights.forEach((insight, index) => {
    const label = INSIGHT_TYPE_LABELS[insight.insightType];
    const floor =
      insight.insightType === "assumption" ? floors.assumption : floors.default;

    // --- Confidence ---------------------------------------------------------
    if (insight.confidence < floor) {
      findings.push({
        severity: "warning",
        entityType: "extracted_insight",
        insightIndex: index,
        title: `Low confidence (${insight.confidence.toFixed(2)}) for a ${scenarioType} project`,
        explanation: `The model reported ${insight.confidence.toFixed(2)} confidence, below the ${floor} floor this project's material is held to. On a ${scenarioType} project that usually means the source does not really say this.`,
        suggestedFix:
          "Open the source text and check the insight against it. If the source does support it, accept and edit the wording; if it does not, dismiss it.",
      });
    }

    // --- Text bounds --------------------------------------------------------
    const length = insight.normalizedText.trim().length;
    if (length < MIN_TEXT_LENGTH) {
      findings.push({
        severity: "warning",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Insight text is too short to stand alone",
        explanation: `“${insight.normalizedText.trim()}” is ${length} characters. An insight has to make sense to someone who has not read the source, and this does not.`,
        suggestedFix: "Rewrite it as a full sentence, or dismiss it and re-extract.",
      });
    } else if (length > MAX_TEXT_LENGTH) {
      findings.push({
        severity: "info",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Insight text is long enough to be several insights",
        explanation: `${length} characters. Long insights usually bundle a goal with its constraint, or two rules that will need to be traced separately.`,
        suggestedFix: "Split it into separate insights before promoting anything from it.",
      });
    }

    // --- Duplicates ---------------------------------------------------------
    const candidate = normalise(insight.normalizedText);
    const twin = seen.find((prior) => similarity(prior, candidate) > DUPLICATE_SIMILARITY);
    if (twin) {
      findings.push({
        severity: "info",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Possible duplicate of an insight already in this project",
        explanation: `This is nearly identical to “${truncate(twin, 100)}”. Two copies of one point become two requirements, and the traceability view then shows the same need sourced twice.`,
        suggestedFix: "Keep whichever is better worded and dismiss the other.",
      });
    }
    seen.push(candidate);

    // --- Scenario flags (brownfield only) -----------------------------------
    if (scenarioType === "brownfield" && insight.contextGap) {
      findings.push({
        severity: "warning",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Context gap — the source is fragmentary here",
        explanation:
          "The model flagged that the material records this without the reasoning or scope around it. Acting on it means guessing at what was decided and why.",
        suggestedFix:
          "Find someone who was there, or record it as an explicit assumption so the gap survives into the pack.",
      });
    }

    if (scenarioType === "brownfield" && insight.changeRisk) {
      findings.push({
        severity: "info",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Change risk — this requires people to work differently",
        explanation:
          "Acting on this insight moves work between roles or removes a step someone currently owns. On an existing operation that is the part that fails, long after the software works.",
        suggestedFix:
          "Name the affected role in the insight, and carry it into the pack as an organisational risk rather than a technical one.",
      });
    }

    // --- Role-aware ---------------------------------------------------------
    if (
      insight.insightType === "goal" &&
      source.uploaderRole === "PM" &&
      containsTechnicalDetail(insight.normalizedText)
    ) {
      findings.push({
        severity: "info",
        entityType: "extracted_insight",
        insightIndex: index,
        title: "Technical detail in a business goal",
        explanation: `This came from material a project manager brought in, and the ${label.toLowerCase()} names a technology rather than an outcome. A goal that specifies the mechanism closes off the alternatives before anyone has compared them.`,
        suggestedFix:
          "Restate it as the outcome the technology was meant to achieve, and move the mechanism to a constraint if it is genuinely fixed.",
      });
    }
  });

  // --- Whole-source observations -------------------------------------------
  if (insights.length === 0) {
    findings.push({
      severity: "warning",
      entityType: "source_document",
      insightIndex: null,
      title: "Nothing was extracted from this source",
      explanation:
        "The model read the material and found nothing that met the confidence floor. Either the source carries no analysable content, or it is written in a way the extraction cannot follow.",
      suggestedFix:
        "Read it yourself before concluding it is empty — and if it does hold something, say so in the source title so the next run has more to go on.",
    });
  }

  return findings;
}

/** Lowercased, punctuation-free word soup. Enough for a duplicate check. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaccard similarity over word sets: shared words over total distinct words.
 *
 * Word-set rather than character-level because the duplicates that actually
 * occur here are the same sentence with a different clause order or a resolved
 * pronoun, which a set comparison catches and an edit distance does not.
 */
function similarity(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;

  return shared / (left.size + right.size - shared);
}

function containsTechnicalDetail(text: string): boolean {
  const words = new Set(normalise(text).split(" "));
  return TECHNICAL_KEYWORDS.some((keyword) => words.has(keyword));
}

/** Roles whose material the role-aware gate applies to. Exported for tests. */
export const ROLE_AWARE_UPLOADERS: ProjectRole[] = ["PM"];
