import { VAGUE_TERMS } from "@/lib/prompts";

/**
 * A heuristic testability score for an acceptance criterion, 0 to 1.
 *
 * This is not a judgement of whether the criterion is *right* — only whether a
 * tester could tell, unambiguously, that it passed. It is deliberately
 * mechanical and explainable: an analyst who disagrees with the score can see
 * exactly which signal produced it, which would not be true of a model call.
 */

const OBSERVABLE_PATTERNS: { pattern: RegExp; weight: number; label: string }[] = [
  // Given/When/Then and its plain-English equivalents.
  { pattern: /\bgiven\b[\s\S]*\bwhen\b[\s\S]*\bthen\b/i, weight: 0.35, label: "Given/When/Then structure" },
  { pattern: /\bwhen\b[\s\S]*\bthen\b/i, weight: 0.2, label: "When/Then structure" },
  // A measurable quantity: number, percentage, duration, currency.
  { pattern: /\b\d+(\.\d+)?\s*(%|percent|seconds?|minutes?|hours?|days?|weeks?|months?|ms|kb|mb|gb)\b/i, weight: 0.25, label: "measurable quantity" },
  { pattern: /[€$£]\s?\d/, weight: 0.2, label: "monetary threshold" },
  { pattern: /\b\d+\b/, weight: 0.1, label: "a number" },
  // An explicit, observable outcome.
  { pattern: /\b(must|shall|will)\b/i, weight: 0.15, label: "obligation wording" },
  { pattern: /\b(is displayed|is shown|is rejected|is recorded|is sent|is created|is prevented|returns|receives|cannot|is not permitted)\b/i, weight: 0.2, label: "observable outcome" },
];

export type TestabilitySignal = {
  label: string;
  present: boolean;
};

export function scoreTestability(criterionText: string): number {
  const value = criterionText.trim();
  if (value.length === 0) return 0;

  let score = 0;
  for (const { pattern, weight } of OBSERVABLE_PATTERNS) {
    if (pattern.test(value)) score += weight;
  }

  // Vague qualifiers actively remove testability — each one is something a
  // tester would have to interpret.
  const vagueHits = countVagueTerms(value);
  score -= vagueHits * 0.25;

  // A criterion too short to contain a condition and an outcome cannot be tested.
  if (value.split(/\s+/).length < 6) score -= 0.2;

  return clamp01(score);
}

/** The signals behind a score, so the quality screen can explain itself. */
export function testabilitySignals(criterionText: string): TestabilitySignal[] {
  return OBSERVABLE_PATTERNS.map(({ pattern, label }) => ({
    label,
    present: pattern.test(criterionText),
  }));
}

export function countVagueTerms(value: string): number {
  return findVagueTerms(value).length;
}

export function findVagueTerms(value: string): string[] {
  const lower = value.toLowerCase();
  return VAGUE_TERMS.filter((term) => {
    // Word-boundary match so "simple" does not fire on "simplified" and
    // "etc" does not fire inside "etcetera".
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
