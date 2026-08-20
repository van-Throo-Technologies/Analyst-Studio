import type { ProjectModel } from "@/lib/schemas/entities";
import type { EntityType, Severity } from "@/lib/schemas/enums";
import { SEVERITY_ORDER } from "@/lib/schemas/enums";
import { findVagueTerms, scoreTestability } from "@/lib/quality/testability";

/**
 * The deterministic quality engine.
 *
 * Runs on every request rather than being stored, so it can never be stale
 * relative to the model. It is cheap (pure functions over an in-memory
 * snapshot) and, more importantly, it is the half of quality review that has
 * to be *reliable*: an analyst should be able to trust that a requirement with
 * no source will always be flagged, not flagged when the model happens to
 * notice.
 *
 * The AI reviewer in /lib/ai/jobs/quality-review.ts handles the half that
 * needs judgement — ambiguity, inconsistency, missing edge cases.
 */

export type QualityFinding = {
  /** Stable within a run — used as a React key and for dismissal later. */
  id: string;
  rule: string;
  severity: Severity;
  entityType: EntityType | "project";
  entityId: string;
  /** Human-facing label: "REQ-001", "UC-003", or a name. */
  entityLabel: string;
  title: string;
  explanation: string;
  suggestedFix: string;
};

export type QualityReport = {
  findings: QualityFinding[];
  counts: Record<Severity, number>;
  /** Fraction of sources that at least one entity references, 0-1. */
  sourceCoverage: number;
  uncoveredSourceIds: string[];
  checkedAt: Date;
};

const MIN_DESCRIPTION_WORDS = 8;

export function runDeterministicChecks(model: ProjectModel): QualityReport {
  const findings: QualityFinding[] = [
    ...checkRequirements(model),
    ...checkUseCases(model),
    ...checkAcceptanceCriteria(model),
    ...checkTraceability(model),
    ...checkModelShape(model),
  ];

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.entityLabel.localeCompare(b.entityLabel);
  });

  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  const { coverage, uncovered } = sourceCoverage(model);

  return {
    findings,
    counts,
    sourceCoverage: coverage,
    uncoveredSourceIds: uncovered,
    checkedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Requirement checks
// ---------------------------------------------------------------------------

function checkRequirements(model: ProjectModel): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const seenTitles = new Map<string, string>();

  for (const req of model.requirements) {
    const at = { entityType: "requirement" as const, entityId: req.id, entityLabel: req.ref };

    if (req.title.trim().length === 0) {
      findings.push({
        ...at,
        id: `${req.id}:missing-title`,
        rule: "requirement.missing_title",
        severity: "critical",
        title: "Requirement has no title",
        explanation:
          "A requirement without a title cannot be referenced in a pack, a conversation or a test plan.",
        suggestedFix: "Give it a one-line title stating the capability required.",
      });
    }

    const descriptionWords = req.description.trim().split(/\s+/).filter(Boolean).length;
    if (descriptionWords < MIN_DESCRIPTION_WORDS) {
      findings.push({
        ...at,
        id: `${req.id}:thin-description`,
        rule: "requirement.description_too_short",
        severity: descriptionWords === 0 ? "warning" : "info",
        title:
          descriptionWords === 0
            ? "Requirement has no description"
            : "Requirement description is very short",
        explanation:
          "The title states what is needed; the description has to make it unambiguous enough to build and test against. This one is too thin to do that.",
        suggestedFix:
          "Describe the behaviour or outcome required, including who it applies to and under what conditions.",
      });
    }

    if (req.sourceRefs.length === 0) {
      findings.push({
        ...at,
        id: `${req.id}:no-source`,
        rule: "requirement.no_source",
        severity: "warning",
        title: "Requirement has no source",
        explanation:
          "Nothing in the discovery material is linked to this requirement, so there is no way to show where it came from or to check it against what a stakeholder actually said.",
        suggestedFix:
          "Link the source document it came from, or record it as an explicit assumption if it was inferred.",
      });
    }

    const vague = findVagueTerms(`${req.title} ${req.description}`);
    if (vague.length > 0) {
      findings.push({
        ...at,
        id: `${req.id}:vague`,
        rule: "requirement.vague_wording",
        severity: "warning",
        title: `Unquantified wording: ${vague.map((v) => `“${v}”`).join(", ")}`,
        explanation:
          "These words mean different things to different readers, so the requirement cannot be objectively verified as met.",
        suggestedFix:
          "Replace each with a measurable statement, or add an acceptance criterion that defines the threshold.",
      });
    }

    const normalized = normalizeTitle(req.title);
    if (normalized.length > 0) {
      const existing = seenTitles.get(normalized);
      if (existing) {
        findings.push({
          ...at,
          id: `${req.id}:duplicate-title`,
          rule: "requirement.duplicate_title",
          severity: "warning",
          title: `Near-duplicate of ${existing}`,
          explanation:
            "Two requirements with effectively the same title will be delivered twice, tested twice, or silently dropped when someone notices.",
          suggestedFix: `Merge with ${existing}, or sharpen both titles so the difference is visible.`,
        });
      } else {
        seenTitles.set(normalized, req.ref);
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Use case checks
// ---------------------------------------------------------------------------

function checkUseCases(model: ProjectModel): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const uc of model.useCases) {
    const at = { entityType: "use_case" as const, entityId: uc.id, entityLabel: uc.ref };

    if (uc.primaryActor.trim().length === 0) {
      findings.push({
        ...at,
        id: `${uc.id}:no-actor`,
        rule: "use_case.no_primary_actor",
        severity: "critical",
        title: "Use case has no primary actor",
        explanation:
          "Without a primary actor there is nobody the flow describes, so it cannot be validated with the people who would perform it.",
        suggestedFix: "Name the actor who initiates this use case.",
      });
    }

    if (uc.trigger.trim().length === 0) {
      findings.push({
        ...at,
        id: `${uc.id}:no-trigger`,
        rule: "use_case.no_trigger",
        severity: "warning",
        title: "Use case has no trigger",
        explanation:
          "The trigger is what tells a developer when this flow starts. Without it the use case reads as a capability rather than a behaviour.",
        suggestedFix: "State the event that starts the flow.",
      });
    }

    if (uc.mainFlow.length === 0) {
      findings.push({
        ...at,
        id: `${uc.id}:no-main-flow`,
        rule: "use_case.no_main_flow",
        severity: "critical",
        title: "Use case has no main flow",
        explanation: "There are no steps, so there is nothing to build or test.",
        suggestedFix: "Add the ordered happy-path steps.",
      });
    }

    if (uc.scopeLevel === "detailed") {
      if (uc.preconditions.length === 0) {
        findings.push({
          ...at,
          id: `${uc.id}:no-preconditions`,
          rule: "use_case.detailed_no_preconditions",
          severity: "warning",
          title: "Detailed use case has no preconditions",
          explanation:
            "A detailed use case is meant to be buildable. Without preconditions it is unclear what state the system must already be in.",
          suggestedFix:
            "State what must be true before the flow can start — authentication, existing data, prior steps.",
        });
      }

      if (uc.alternateFlows.length === 0 && uc.exceptionFlows.length === 0) {
        findings.push({
          ...at,
          id: `${uc.id}:no-branches`,
          rule: "use_case.detailed_no_branches",
          severity: "warning",
          title: "Detailed use case covers only the happy path",
          explanation:
            "Every real flow has a way to fail or diverge. A detailed use case with no alternate or exception flow will push those decisions into development, where they get made by accident.",
          suggestedFix:
            "Add at least the most likely failure — missing data, a rejected input, an unavailable dependency.",
        });
      }
    }

    if (uc.sourceRefs.length === 0 && uc.requirementId === null) {
      findings.push({
        ...at,
        id: `${uc.id}:unanchored`,
        rule: "use_case.unanchored",
        severity: "warning",
        title: "Use case has neither a parent requirement nor a source",
        explanation:
          "This use case is not connected to anything, so it will appear in a pack with no justification behind it.",
        suggestedFix: "Attach it to the requirement it realises, or link its source.",
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Acceptance criteria checks
// ---------------------------------------------------------------------------

function checkAcceptanceCriteria(model: ProjectModel): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const seen = new Map<string, string>();

  for (const ac of model.acceptanceCriteria) {
    const at = {
      entityType: "acceptance_criterion" as const,
      entityId: ac.id,
      entityLabel: ac.ref,
    };

    const vague = findVagueTerms(ac.text);
    if (vague.length > 0) {
      findings.push({
        ...at,
        id: `${ac.id}:vague`,
        rule: "criterion.vague_wording",
        severity: "warning",
        title: `Criterion uses unquantified wording: ${vague.map((v) => `“${v}”`).join(", ")}`,
        explanation:
          "A tester cannot mark this pass or fail without deciding for themselves what the word means.",
        suggestedFix: "Replace with an observable condition and a threshold.",
      });
    }

    // Recomputed rather than read from the stored score, so a hand-edited
    // database row cannot hide a bad criterion from this check.
    const score = scoreTestability(ac.text);
    if (score < 0.35) {
      findings.push({
        ...at,
        id: `${ac.id}:untestable`,
        rule: "criterion.not_testable",
        severity: score < 0.15 ? "critical" : "warning",
        title: "Criterion is not testable as written",
        explanation:
          "It does not state an observable condition with a definite outcome, so there is no way to demonstrate it has been met.",
        suggestedFix:
          "Rewrite as a condition and a result — for example “Given a submission without a date of loss, when the customer submits, then the submission is rejected with a validation message.”",
      });
    }

    if (!/\d/.test(ac.text) && !/\b(is|are|must|shall|cannot|will)\b/i.test(ac.text)) {
      findings.push({
        ...at,
        id: `${ac.id}:no-measurable`,
        rule: "criterion.no_measurable_condition",
        severity: "info",
        title: "Criterion has no measurable condition",
        explanation:
          "There is neither a quantity nor a definite obligation, so the criterion is descriptive rather than verifiable.",
        suggestedFix: "Add the threshold, count, or definite outcome that has to hold.",
      });
    }

    if (ac.requirementId === null) {
      findings.push({
        ...at,
        id: `${ac.id}:orphan`,
        rule: "criterion.no_parent_requirement",
        severity: "warning",
        title: "Criterion is not attached to a requirement",
        explanation:
          "An acceptance criterion defines when a requirement is satisfied. On its own it defines nothing.",
        suggestedFix: "Attach it to the requirement it verifies.",
      });
    }

    const normalized = normalizeTitle(ac.text);
    if (normalized.length > 0) {
      const existing = seen.get(normalized);
      if (existing) {
        findings.push({
          ...at,
          id: `${ac.id}:duplicate`,
          rule: "criterion.duplicate",
          severity: "info",
          title: `Duplicate of ${existing}`,
          explanation: "The same criterion appears twice and will be tested twice.",
          suggestedFix: `Delete this one or differentiate it from ${existing}.`,
        });
      } else {
        seen.set(normalized, ac.ref);
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Traceability checks
// ---------------------------------------------------------------------------

function checkTraceability(model: ProjectModel): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const sourceIds = new Set(model.sourceDocuments.map((s) => s.id));

  // A sourceRef pointing at a deleted document is worse than no source: it
  // looks traceable in a list view and is not.
  const withRefs: {
    label: string;
    id: string;
    type: EntityType;
    refs: string[];
  }[] = [
    ...model.requirements.map((r) => ({ label: r.ref, id: r.id, type: "requirement" as const, refs: r.sourceRefs })),
    ...model.useCases.map((u) => ({ label: u.ref, id: u.id, type: "use_case" as const, refs: u.sourceRefs })),
    ...model.acceptanceCriteria.map((a) => ({ label: a.ref, id: a.id, type: "acceptance_criterion" as const, refs: a.sourceRefs })),
    ...model.businessRules.map((b) => ({ label: truncateLabel(b.ruleText), id: b.id, type: "business_rule" as const, refs: b.sourceRefs })),
    ...model.businessGoals.map((g) => ({ label: g.title, id: g.id, type: "business_goal" as const, refs: g.sourceRefs })),
    ...model.stakeholders.map((s) => ({ label: s.name, id: s.id, type: "stakeholder" as const, refs: s.sourceRefs })),
    ...model.actors.map((a) => ({ label: a.name, id: a.id, type: "actor" as const, refs: a.sourceRefs })),
  ];

  for (const entity of withRefs) {
    const dangling = entity.refs.filter((ref) => !sourceIds.has(ref));
    if (dangling.length > 0) {
      findings.push({
        id: `${entity.id}:dangling-source`,
        rule: "trace.dangling_source_ref",
        severity: "critical",
        entityType: entity.type,
        entityId: entity.id,
        entityLabel: entity.label,
        title: "Points at a source that no longer exists",
        explanation:
          "The linked source document has been deleted, so this item looks traceable but cannot be traced.",
        suggestedFix: "Re-link it to an existing source, or clear the stale reference.",
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Whole-model checks
// ---------------------------------------------------------------------------

function checkModelShape(model: ProjectModel): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const project = {
    entityType: "project" as const,
    entityId: model.project.id,
    entityLabel: model.project.name,
  };

  const requirementsWithCriteria = new Set(
    model.acceptanceCriteria.map((a) => a.requirementId).filter(Boolean),
  );
  const uncovered = model.requirements.filter((r) => !requirementsWithCriteria.has(r.id));

  if (model.requirements.length > 0 && uncovered.length > 0) {
    findings.push({
      ...project,
      id: `${model.project.id}:requirements-without-criteria`,
      rule: "model.requirements_without_criteria",
      severity: uncovered.length === model.requirements.length ? "warning" : "info",
      title: `${uncovered.length} of ${model.requirements.length} requirements have no acceptance criteria`,
      explanation: `Without criteria there is no agreed definition of done for ${uncovered
        .slice(0, 5)
        .map((r) => r.ref)
        .join(", ")}${uncovered.length > 5 ? ` and ${uncovered.length - 5} more` : ""}.`,
      suggestedFix:
        "Draft criteria for each — the acceptance criteria job on the requirement detail page will propose a starting set.",
    });
  }

  if (model.requirements.length > 0 && model.useCases.length === 0) {
    findings.push({
      ...project,
      id: `${model.project.id}:no-use-cases`,
      rule: "model.no_use_cases",
      severity: "info",
      title: "No use cases yet",
      explanation:
        "Both pack types include a use case section. Without any, the pack will describe what is needed but not how it plays out.",
      suggestedFix: "Draft use cases for the highest-priority requirements.",
    });
  }

  if (model.stakeholders.length === 0 && model.sourceDocuments.length > 0) {
    findings.push({
      ...project,
      id: `${model.project.id}:no-stakeholders`,
      rule: "model.no_stakeholders",
      severity: "info",
      title: "No stakeholders recorded",
      explanation:
        "The BA pack has a stakeholder section, and stakeholder gaps are one of the most common causes of missed requirements.",
      suggestedFix:
        "Promote stakeholders from extraction, or add them directly in the requirement model.",
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------

function sourceCoverage(model: ProjectModel): {
  coverage: number;
  uncovered: string[];
} {
  if (model.sourceDocuments.length === 0) return { coverage: 0, uncovered: [] };

  const referenced = new Set<string>();
  const collect = (refs: string[]) => refs.forEach((r) => referenced.add(r));

  model.requirements.forEach((r) => collect(r.sourceRefs));
  model.useCases.forEach((u) => collect(u.sourceRefs));
  model.acceptanceCriteria.forEach((a) => collect(a.sourceRefs));
  model.businessRules.forEach((b) => collect(b.sourceRefs));
  model.businessGoals.forEach((g) => collect(g.sourceRefs));
  model.stakeholders.forEach((s) => collect(s.sourceRefs));
  model.actors.forEach((a) => collect(a.sourceRefs));
  // An accepted insight counts as coverage — the source has been read and its
  // content is carried into the assumption / constraint / risk register.
  model.insights
    .filter((i) => i.status === "accepted" || i.status === "promoted")
    .forEach((i) => referenced.add(i.sourceDocumentId));

  const uncovered = model.sourceDocuments
    .filter((s) => !referenced.has(s.id))
    .map((s) => s.id);

  return {
    coverage: (model.sourceDocuments.length - uncovered.length) / model.sourceDocuments.length,
    uncovered,
  };
}

/** Loose normalisation for near-duplicate detection. */
function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .sort()
    .join(" ");
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "must", "shall", "should",
  "will", "can", "able", "system", "user", "from", "into", "when", "then",
  "given", "have", "has", "are", "was", "were", "been", "being",
]);

function truncateLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 59)}…`;
}
