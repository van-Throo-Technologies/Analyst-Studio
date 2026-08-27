// Quality checks over an extracted requirement set.
//
// Deliberately deterministic — no model call. The same requirements always
// produce the same findings, which is what makes "fix it and re-check" mean
// something. Every check below is a heuristic; each one says what it found and
// what to do, and none of them silently rewrites anything.
//
// No "server-only": the report renders in a Client Component too.

export type QualityIssueType =
  | "ungrounded"
  | "ambiguity"
  | "missing-field"
  | "non-testable"
  | "incomplete-usecase"
  | "duplicate"
  | "conflict"
  | "missing-ac"
  | "priority-mismatch";

export type Severity = "high" | "medium" | "low";

export type QualityIssue = {
  requirementId: string;
  requirementTitle: string;
  type: QualityIssueType;
  severity: Severity;
  message: string;
  suggestion: string;
};

export type QualityReport = {
  score: number;
  issues: QualityIssue[];
  counts: Record<Severity, number>;
  checked: number;
};

export type CheckableRequirement = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  actor: string | null;
  trigger: string | null;
  happyPath: string | null;
  alternateFlows: string | null;
  bdDAC: string | null;
  checklistAC: string | null;
  completionScore: number;
  // Optional so the same checks can run mid-pipeline, before grounding has been
  // verified, as well as against saved requirements afterwards.
  isGrounded?: boolean;
  validationGates?: string | null;
};

function lines(value: string | null): string[] {
  if (!value) return [];
  return value.split("\n").map((l) => l.trim()).filter(Boolean);
}

// Words that describe a feeling about the system rather than a fact about it.
// "Fast" cannot be tested; "under 200ms" can.
const VAGUE_TERMS = [
  "soon", "quickly", "fast", "slow", "easy", "easily", "simple", "intuitive",
  "user-friendly", "friendly", "many", "few", "several", "some", "most",
  "appropriate", "adequate", "sufficient", "reasonable", "robust", "seamless",
  "efficient", "flexible", "scalable", "modern", "better", "improved",
  "as needed", "if necessary", "etc", "and so on", "various", "minimal",
  "acceptable", "optimal", "significant", "regularly", "periodically",
];

// A criterion with a number, a state, a comparison or a flat negation in it can
// be checked. Negations count: "no mandatory data entry" is something a tester
// can sit down and disprove, which is the whole bar here.
const MEASURABLE = /\b(\d+|all|no|not|none|every|each|exactly|at least|at most|within|before|after|equal|greater|less|cannot|always|never|only|must)\b/i;

// Only meaningful once grounding has been verified — undefined means the check
// has not run yet, which is not the same as failing it.
export function checkGrounding(r: CheckableRequirement): QualityIssue[] {
  if (r.isGrounded !== false) return [];

  return [
    {
      requirementId: r.id,
      requirementTitle: r.title,
      type: "ungrounded",
      severity: "high",
      message: "No quote from the source could be verified for this requirement.",
      suggestion:
        "Treat it as an inference rather than something anyone said. Confirm it with the people involved, or delete it.",
    },
  ];
}

export function checkAmbiguity(r: CheckableRequirement): QualityIssue[] {
  const haystack = `${r.title} ${r.description}`.toLowerCase();
  // Vagueness already raised as an open question has been dealt with — the
  // requirement is being precise about its own imprecision, which is the
  // correct outcome when the source itself never said. Reporting it again would
  // punish the requirement for quoting the person who was vague.
  const escalated = (r.validationGates ?? "").toLowerCase();

  const word = (term: string) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);

  const found = VAGUE_TERMS.filter(
    (term) => word(term).test(haystack) && !word(term).test(escalated),
  );
  if (found.length === 0) return [];

  return [
    {
      requirementId: r.id,
      requirementTitle: r.title,
      type: "ambiguity",
      severity: found.length > 2 ? "high" : "medium",
      message: `Vague wording: ${found.map((f) => `"${f}"`).join(", ")}.`,
      suggestion:
        "Replace each with something countable. \"Fast\" becomes a number; \"many users\" becomes a figure someone will commit to.",
    },
  ];
}

export function checkMissingFields(r: CheckableRequirement): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (!r.title.trim()) {
    issues.push({
      requirementId: r.id,
      requirementTitle: r.title || "(untitled)",
      type: "missing-field",
      severity: "high",
      message: "No title.",
      suggestion: "Give it a short imperative phrase so it can be referred to in a conversation.",
    });
  }

  if (r.description.trim().length < 25) {
    issues.push({
      requirementId: r.id,
      requirementTitle: r.title,
      type: "missing-field",
      severity: "medium",
      message: "The description is too short to stand on its own.",
      suggestion: "Write two or three sentences for a reader who was not in the room — what is needed, and why.",
    });
  }

  return issues;
}

export function checkTestability(r: CheckableRequirement): QualityIssue[] {
  const criteria = [...lines(r.bdDAC), ...lines(r.checklistAC)];
  if (criteria.length === 0) return [];

  const untestable = criteria.filter((c) => !MEASURABLE.test(c));
  if (untestable.length === 0) return [];

  return [
    {
      requirementId: r.id,
      requirementTitle: r.title,
      type: "non-testable",
      severity: untestable.length === criteria.length ? "medium" : "low",
      message: `${untestable.length} of ${criteria.length} acceptance criteria have nothing measurable in them.`,
      suggestion:
        "A criterion a tester cannot pass or fail is a wish. Add the number, the state or the comparison being asserted.",
    },
  ];
}

export function checkUseCaseCompleteness(r: CheckableRequirement): QualityIssue[] {
  // Only requirements that are trying to be use cases are held to this.
  const isUseCase = Boolean(r.actor || r.trigger || r.happyPath);
  if (!isUseCase) return [];

  // Bare nouns, so the message reads "has no main flow, no alternate flows".
  const missing: string[] = [];
  if (!r.happyPath) missing.push("main flow");
  if (lines(r.alternateFlows).length === 0) missing.push("alternate flows");
  if (!r.trigger) missing.push("trigger");
  if (missing.length === 0) return [];

  return [
    {
      requirementId: r.id,
      requirementTitle: r.title,
      type: "incomplete-usecase",
      severity: missing.includes("main flow") ? "medium" : "low",
      message: `Reads like a use case but has no ${missing.join(", no ")}.`,
      suggestion:
        "Walk the path end to end, then ask what happens when it goes wrong. The exception cases are where the cost hides.",
    },
  ];
}

export function checkAcceptanceCriteria(r: CheckableRequirement): QualityIssue[] {
  if (lines(r.bdDAC).length > 0 || lines(r.checklistAC).length > 0) return [];

  return [
    {
      requirementId: r.id,
      requirementTitle: r.title,
      type: "missing-ac",
      severity: "high",
      message: "No acceptance criteria.",
      suggestion:
        "Without them nobody can agree the requirement is met. Write at least one Given/When/Then before this goes to build.",
    },
  ];
}

// Dice coefficient over word bigrams. Cheap, order-insensitive, and good enough
// to catch the same need voiced twice in different words.
function similarity(a: string, b: string): number {
  const bigrams = (text: string) => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const pairs = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) pairs.add(`${words[i]} ${words[i + 1]}`);
    return pairs;
  };

  const first = bigrams(a);
  const second = bigrams(b);
  if (first.size === 0 || second.size === 0) return 0;

  let shared = 0;
  for (const pair of first) if (second.has(pair)) shared++;
  return (2 * shared) / (first.size + second.size);
}

export function checkDuplicates(requirements: CheckableRequirement[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const a = requirements[i];
      const b = requirements[j];
      const score = Math.max(
        similarity(a.description, b.description),
        similarity(a.title, b.title),
      );
      if (score < 0.8) continue;

      // Reported once, against the later of the pair, so the reader is not shown
      // the same overlap twice from both directions.
      issues.push({
        requirementId: b.id,
        requirementTitle: b.title,
        type: "duplicate",
        severity: "medium",
        message: `${Math.round(score * 100)}% similar to "${a.title}".`,
        suggestion:
          "Merge them, or sharpen the wording until the difference between the two is obvious.",
      });
    }
  }

  return issues;
}

// A heuristic, not semantic understanding: two requirements aimed at the same
// actor and trigger where one forbids what the other requires. It will miss
// subtler contradictions — a clean run here is not proof of consistency.
const NEGATION = /\b(not|never|cannot|must not|prevent|forbid|block|disallow|reject|without)\b/i;

export function checkConflicts(requirements: CheckableRequirement[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const a = requirements[i];
      const b = requirements[j];

      const sameSubject =
        a.actor && b.actor && a.actor.toLowerCase() === b.actor.toLowerCase() &&
        similarity(a.description, b.description) > 0.35;
      if (!sameSubject) continue;

      const aNegates = NEGATION.test(a.description);
      const bNegates = NEGATION.test(b.description);
      if (aNegates === bNegates) continue;

      issues.push({
        requirementId: b.id,
        requirementTitle: b.title,
        type: "conflict",
        severity: "high",
        message: `May contradict "${a.title}" — both concern ${a.actor}, but one permits what the other prevents.`,
        suggestion:
          "Read them side by side. If both are right, the difference is a condition neither one states yet.",
      });
    }
  }

  return issues;
}

// One requirement flagged for the whole set, not per requirement: the problem
// is the distribution, not any single entry.
export function checkPriorityBalance(requirements: CheckableRequirement[]): QualityIssue[] {
  if (requirements.length < 5) return [];

  const high = requirements.filter((r) => r.priority === "High");
  const share = high.length / requirements.length;
  if (share <= 0.7) return [];

  return [
    {
      requirementId: high[0].id,
      requirementTitle: `${high.length} of ${requirements.length} requirements`,
      type: "priority-mismatch",
      severity: "medium",
      message: `${Math.round(share * 100)}% are High priority.`,
      suggestion:
        "When almost everything is top priority, the ranking has stopped carrying information. Ask which of these could slip a release without anyone minding.",
    },
  ];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 5, medium: 2, low: 1 };

export function runAllChecks(requirements: CheckableRequirement[]): QualityReport {
  const issues: QualityIssue[] = [
    ...requirements.flatMap(checkGrounding),
    ...requirements.flatMap(checkAmbiguity),
    ...requirements.flatMap(checkMissingFields),
    ...requirements.flatMap(checkTestability),
    ...requirements.flatMap(checkUseCaseCompleteness),
    ...requirements.flatMap(checkAcceptanceCriteria),
    ...checkDuplicates(requirements),
    ...checkConflicts(requirements),
    ...checkPriorityBalance(requirements),
  ];

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  const counts = {
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
  };

  // Scored against the requirement count so that a large set is not punished
  // simply for being large. Penalty is capped so the score degrades rather than
  // collapsing to zero on the first bad batch.
  const penalty = issues.reduce((sum, i) => sum + SEVERITY_WEIGHT[i.severity], 0);
  const ceiling = Math.max(requirements.length, 1) * 10;
  const score = requirements.length === 0
    ? 0
    : Math.max(0, Math.round(100 - (penalty / ceiling) * 100));

  return { score, issues, counts, checked: requirements.length };
}

export const ISSUE_LABELS: Record<QualityIssueType, string> = {
  ungrounded: "No verified evidence",
  ambiguity: "Ambiguous wording",
  "missing-field": "Missing field",
  "non-testable": "Not testable",
  "incomplete-usecase": "Incomplete use case",
  duplicate: "Possible duplicate",
  conflict: "Possible conflict",
  "missing-ac": "No acceptance criteria",
  "priority-mismatch": "Priority distribution",
};
