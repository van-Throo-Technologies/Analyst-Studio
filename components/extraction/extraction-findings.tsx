"use client";

import { useState } from "react";
import { dismissFindingAction } from "@/app/projects/[id]/quality/actions";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { SeverityBadge } from "@/components/ui/badges";
import { SEVERITY_ORDER, type Severity } from "@/lib/schemas/enums";
import { pluralize } from "@/lib/utils";

export type ExtractionFindingView = {
  id: string;
  severity: Severity;
  title: string;
  explanation: string;
  suggestedFix: string;
  /** The insight this is about, when it is about one. */
  insightText: string | null;
};

/**
 * Quality findings from the extraction gates.
 *
 * Collapsed to a count line by default. These are triage, not the work: an
 * analyst reviewing forty insights wants to know that three are low-confidence
 * and one may be a duplicate, and to open only those. Every finding carries the
 * rule that produced it, so none of them needs to be taken on trust.
 */
export function ExtractionFindings({
  projectId,
  findings,
}: {
  projectId: string;
  findings: ExtractionFindingView[];
}) {
  const [open, setOpen] = useState(false);

  if (findings.length === 0) return null;

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const counts = sorted.reduce<Record<Severity, number>>(
    (acc, finding) => ({ ...acc, [finding.severity]: acc[finding.severity] + 1 }),
    { critical: 0, warning: 0, info: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quality findings</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint">
            {counts.critical > 0 ? `${counts.critical} critical · ` : ""}
            {counts.warning} warning{counts.warning === 1 ? "" : "s"} · {counts.info} info
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Review"}
          </Button>
        </div>
      </CardHeader>

      {open ? (
        <ul className="divide-y divide-line">
          {sorted.map((finding) => (
            <FindingRow key={finding.id} projectId={projectId} finding={finding} />
          ))}
        </ul>
      ) : (
        <CardBody>
          <p className="text-sm text-ink-muted">
            {pluralize(findings.length, "check")} flagged something worth a look before
            you promote anything. Every one names the rule it came from.
          </p>
        </CardBody>
      )}
    </Card>
  );
}

function FindingRow({
  projectId,
  finding,
}: {
  projectId: string;
  finding: ExtractionFindingView;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="px-5 py-3">
      <div className="flex items-start gap-3">
        <SeverityBadge severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left text-sm font-medium text-ink hover:underline"
          >
            {finding.title}
          </button>

          {finding.insightText ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
              {finding.insightText}
            </p>
          ) : null}

          {expanded ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-ink-soft">{finding.explanation}</p>
              {finding.suggestedFix ? (
                <p className="text-ink-muted">
                  <span className="font-medium text-ink-soft">What to do: </span>
                  {finding.suggestedFix}
                </p>
              ) : null}
              <form action={dismissFindingAction.bind(null, projectId, finding.id)}>
                <Button size="sm" type="submit">
                  Dismiss finding
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
