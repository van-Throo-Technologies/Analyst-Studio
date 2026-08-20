import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ANALYSIS_MODE_LABELS,
  CRITERION_TYPE_LABELS,
  INDUSTRY_LABELS,
  INSIGHT_STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_ROLE_HINTS,
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_LABELS,
  REGULATORY_SENSITIVITY_HINTS,
  REGULATORY_SENSITIVITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPE_LABELS,
  SCENARIO_TYPE_DESCRIPTIONS,
  SCENARIO_TYPE_LABELS,
  SCOPE_LEVEL_LABELS,
  SEVERITY_LABELS,
  SOURCE_PROVENANCE_HINTS,
  SOURCE_PROVENANCE_LABELS,
  SOURCE_TYPE_LABELS,
  VALIDATION_STATUS_HINTS,
  VALIDATION_STATUS_LABELS,
  type AnalysisMode,
  type CriterionType,
  type Industry,
  type InsightStatus,
  type Priority,
  type ProjectRole,
  type ProjectStatus,
  type RegulatorySensitivity,
  type RequirementStatus,
  type RequirementType,
  type ScenarioType,
  type ScopeLevel,
  type Severity,
  type SourceProvenance,
  type SourceType,
  type ValidationStatus,
} from "@/lib/schemas/enums";

/**
 * Every badge in the app is defined here, so a colour never means two things.
 * The tones are intentionally few: neutral for classification, and the three
 * semantic tones only where something needs attention.
 */

type Tone = "neutral" | "accent" | "critical" | "warning" | "positive";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-muted text-ink-soft",
  accent: "border-accent-line bg-accent-soft text-accent",
  critical: "border-critical-line bg-critical-soft text-critical",
  warning: "border-warning-line bg-warning-soft text-warning",
  positive: "border-positive-line bg-positive-soft text-positive",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: AnalysisMode }) {
  return (
    <Badge tone="accent" className="font-semibold">
      <span title={ANALYSIS_MODE_LABELS[mode]}>{mode}</span>
    </Badge>
  );
}

const PROJECT_STATUS_TONES: Record<ProjectStatus, Tone> = {
  draft: "neutral",
  in_analysis: "accent",
  review: "warning",
  delivered: "positive",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={PROJECT_STATUS_TONES[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>
  );
}

export function SourceTypeBadge({ type }: { type: SourceType }) {
  return <Badge>{SOURCE_TYPE_LABELS[type]}</Badge>;
}

/**
 * Where the material came from. Classification, not status — always neutral.
 *
 * Reads "via Jira export", because the interesting provenance is always the
 * one that differs from the document itself. Pass `sourceType` and the badge
 * disappears when it would only repeat it: workshop notes that came from the
 * workshop are the unremarkable case, and two identical badges side by side
 * read as a bug rather than as a fact.
 */
export function SourceProvenanceBadge({
  provenance,
  sourceType,
}: {
  provenance: SourceProvenance;
  sourceType?: SourceType;
}) {
  if (sourceType && SOURCE_PROVENANCE_LABELS[provenance] === SOURCE_TYPE_LABELS[sourceType]) {
    return null;
  }
  return (
    <Badge>
      <span title={SOURCE_PROVENANCE_HINTS[provenance]}>
        via {SOURCE_PROVENANCE_LABELS[provenance]}
      </span>
    </Badge>
  );
}

/**
 * Unvalidated material is warning-toned rather than neutral on purpose: a
 * source nobody has vouched for is the normal state early on, and the whole
 * point is that it stays visible until someone deals with it.
 */
const VALIDATION_STATUS_TONES: Record<ValidationStatus, Tone> = {
  pending: "warning",
  validated: "positive",
  rejected: "critical",
};

export function ValidationStatusBadge({ status }: { status: ValidationStatus }) {
  return (
    <Badge tone={VALIDATION_STATUS_TONES[status]}>
      <span title={VALIDATION_STATUS_HINTS[status]}>
        {VALIDATION_STATUS_LABELS[status]}
      </span>
    </Badge>
  );
}

/**
 * The viewer's own role on a project. Accent-toned because it is about *you* —
 * it answers "what am I allowed to do here", not "what kind of thing is this".
 * Reviewer is warning-toned because read-only is a constraint worth noticing.
 */
export function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <Badge tone={role === "REVIEWER" ? "warning" : "accent"}>
      <span title={PROJECT_ROLE_HINTS[role]}>{PROJECT_ROLE_LABELS[role]}</span>
    </Badge>
  );
}

/** Brownfield is flagged; greenfield is the unremarkable case. */
export function ScenarioBadge({ scenario }: { scenario: ScenarioType }) {
  if (scenario === "greenfield") return null;
  return (
    <Badge>
      <span title={SCENARIO_TYPE_DESCRIPTIONS[scenario]}>
        {SCENARIO_TYPE_LABELS[scenario]}
      </span>
    </Badge>
  );
}

/** Industry is classification, not a status — always neutral. */
export function IndustryBadge({ industry }: { industry: Industry }) {
  if (industry === "other") return null;
  return <Badge>{INDUSTRY_LABELS[industry]}</Badge>;
}

const REGULATORY_SENSITIVITY_TONES: Record<RegulatorySensitivity, Tone> = {
  low: "neutral",
  medium: "warning",
  high: "critical",
};

/**
 * Shown only at medium and high. A "Low" badge on every project would be noise
 * that trains people to stop reading the badge row.
 */
export function RegulatorySensitivityBadge({
  sensitivity,
}: {
  sensitivity: RegulatorySensitivity;
}) {
  if (sensitivity === "low") return null;
  return (
    <Badge
      tone={REGULATORY_SENSITIVITY_TONES[sensitivity]}
      className="font-medium"
    >
      <span title={REGULATORY_SENSITIVITY_HINTS[sensitivity]}>
        {REGULATORY_SENSITIVITY_LABELS[sensitivity]} regulatory
      </span>
    </Badge>
  );
}

const PRIORITY_TONES: Record<Priority, Tone> = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
  critical: "critical",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

const REQUIREMENT_STATUS_TONES: Record<RequirementStatus, Tone> = {
  draft: "neutral",
  reviewed: "accent",
  approved: "positive",
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return (
    <Badge tone={REQUIREMENT_STATUS_TONES[status]}>
      {REQUIREMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RequirementTypeBadge({ type }: { type: RequirementType }) {
  return <Badge>{REQUIREMENT_TYPE_LABELS[type]}</Badge>;
}

export function CriterionTypeBadge({ type }: { type: CriterionType }) {
  return <Badge>{CRITERION_TYPE_LABELS[type]}</Badge>;
}

export function ScopeLevelBadge({ level }: { level: ScopeLevel }) {
  return <Badge>{SCOPE_LEVEL_LABELS[level]}</Badge>;
}

const SEVERITY_TONES: Record<Severity, Tone> = {
  info: "accent",
  warning: "warning",
  critical: "critical",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONES[severity]}>{SEVERITY_LABELS[severity]}</Badge>;
}

const INSIGHT_STATUS_TONES: Record<InsightStatus, Tone> = {
  pending: "warning",
  accepted: "accent",
  dismissed: "neutral",
  promoted: "positive",
};

export function InsightStatusBadge({ status }: { status: InsightStatus }) {
  return (
    <Badge tone={INSIGHT_STATUS_TONES[status]}>{INSIGHT_STATUS_LABELS[status]}</Badge>
  );
}

/**
 * Model-reported extraction confidence.
 *
 * Colour-coded at the Phase 3 thresholds — below 0.6 critical, to 0.8 warning,
 * above that positive. Colour on a model-reported number is a real risk of
 * overstating its precision, so it stays a plain figure with a tone rather than
 * a bar or a gauge, and the title says where the number came from.
 */
export function ConfidenceBadge({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const pct = Math.round(clamped * 100);
  const tone =
    clamped < 0.6 ? "text-critical" : clamped <= 0.8 ? "text-warning" : "text-positive";

  return (
    <span
      className={cn("font-mono text-[11px] font-medium tabular-nums", tone)}
      title={`Model-reported extraction confidence: ${clamped.toFixed(2)}`}
    >
      {pct}%
    </span>
  );
}
