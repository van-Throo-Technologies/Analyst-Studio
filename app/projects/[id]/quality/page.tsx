import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listAiGenerations,
  listOpenAiFindings,
  loadProjectModel,
} from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/ai/client";
import { runDeterministicChecks } from "@/lib/quality/deterministic";
import { buildTraceGraph } from "@/lib/trace/graph";
import { AI_JOB_LABELS, SEVERITY_ORDER, type AiJob } from "@/lib/schemas/enums";
import { cn, formatDateTime, pluralize } from "@/lib/utils";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Ref,
} from "@/components/ui";
import { SeverityBadge } from "@/components/ui/badges";
import { QualityReviewRunner } from "@/components/quality/quality-review-runner";
import { DismissFindingButton } from "@/components/quality/dismiss-finding-button";
import { TraceView } from "@/components/quality/trace-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quality & trace" };

export default async function QualityPage({
  params,
}: PageProps<"/projects/[id]/quality">) {
  const { id } = await params;

  const model = await loadProjectModel(id);
  if (!model) notFound();

  const [aiFindings, generations] = await Promise.all([
    listOpenAiFindings(id),
    listAiGenerations(id, 15),
  ]);

  const report = runDeterministicChecks(model);
  const trace = buildTraceGraph(model);

  const sortedAiFindings = [...aiFindings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const refLabel = buildRefLabels(model);

  return (
    <>
      <PageHeader
        title="Quality & traceability"
        description="Automatic checks run every time you open this page, so they are never stale. The AI review is a separate pass over the things a checklist cannot see."
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat
            label="Critical"
            value={report.counts.critical}
            tone={report.counts.critical > 0 ? "critical" : "neutral"}
          />
          <Stat
            label="Warnings"
            value={report.counts.warning}
            tone={report.counts.warning > 0 ? "warning" : "neutral"}
          />
          <Stat label="Info" value={report.counts.info} tone="neutral" />
          <Stat
            label="Source coverage"
            value={`${Math.round(report.sourceCoverage * 100)}%`}
            tone={report.sourceCoverage < 1 ? "warning" : "positive"}
            hint={`${trace.totals.coveredSources} of ${trace.totals.sources} sources used`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Automatic checks</CardTitle>
            <span className="text-xs text-ink-faint">
              Recomputed {formatDateTime(report.checkedAt)}
            </span>
          </CardHeader>
          {report.findings.length === 0 ? (
            <CardBody>
              <p className="text-sm text-positive">
                Nothing flagged. Every requirement has a title, a source and a
                priority; every use case has an actor, a trigger and a flow; every
                criterion states a testable condition.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {report.findings.map((finding) => (
                <li key={finding.id} className="flex gap-3 px-5 py-3">
                  <SeverityBadge severity={finding.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <FindingLink
                        projectId={id}
                        entityType={finding.entityType}
                        entityId={finding.entityId}
                        label={finding.entityLabel}
                        model={model}
                      />
                      {finding.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {finding.explanation}
                    </p>
                    <p className="mt-0.5 text-xs text-accent">{finding.suggestedFix}</p>
                  </div>
                  <code className="shrink-0 text-[10px] text-ink-faint">
                    {finding.rule}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI review</CardTitle>
            <QualityReviewRunner
              projectId={id}
              mode={model.project.defaultMode}
              aiConfigured={isAiConfigured()}
            />
          </CardHeader>
          {sortedAiFindings.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-muted">
                No open AI findings. The review looks for ambiguity, inconsistency,
                missing edge cases and framing that is wrong for the mode — the things
                the automatic checks above cannot see. It is told what those checks
                already found so it does not repeat them.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {sortedAiFindings.map((finding) => (
                <li key={finding.id} className="flex gap-3 px-5 py-3">
                  <SeverityBadge severity={finding.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {refLabel.get(finding.entityId) ? (
                        <Ref className="mr-1.5">{refLabel.get(finding.entityId)}</Ref>
                      ) : null}
                      {finding.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {finding.explanation}
                    </p>
                    {finding.suggestedFix ? (
                      <p className="mt-0.5 text-xs text-accent">
                        {finding.suggestedFix}
                      </p>
                    ) : null}
                  </div>
                  <DismissFindingButton projectId={id} findingId={finding.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <TraceView projectId={id} graph={trace} />

        <Card>
          <CardHeader>
            <CardTitle>Generation log</CardTitle>
            <span className="text-xs text-ink-faint">
              {pluralize(generations.length, "recent run")}
            </span>
          </CardHeader>
          {generations.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-muted">
                No AI runs yet. Every run is recorded here with its model, prompt
                version and raw output — nothing is discarded.
              </p>
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="px-5 py-2 font-medium">Job</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Prompt</th>
                    <th className="px-3 py-2 font-medium">Tokens</th>
                    <th className="px-3 py-2 font-medium">Took</th>
                    <th className="px-5 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {generations.map((generation) => (
                    <tr key={generation.id}>
                      <td className="px-5 py-2">
                        <span
                          className={
                            generation.outcome === "ok" ? "text-ink" : "text-critical"
                          }
                        >
                          {AI_JOB_LABELS[generation.job as AiJob] ?? generation.job}
                        </span>
                        {generation.outcome !== "ok" ? (
                          <span className="ml-1.5 text-[11px] text-critical">
                            {generation.outcome.replace(/_/g, " ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                        {generation.model}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                        {generation.promptId}@{generation.promptVersion}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs text-ink-muted">
                        {generation.inputTokens.toLocaleString()} in ·{" "}
                        {generation.outputTokens.toLocaleString()} out
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs text-ink-muted">
                        {(generation.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-5 py-2 text-xs text-ink-faint">
                        {formatDateTime(generation.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "warning" | "critical" | "positive";
  hint?: string;
}) {
  const tones = {
    neutral: "text-ink",
    warning: "text-warning",
    critical: "text-critical",
    positive: "text-positive",
  };
  return (
    <Card>
      <CardBody className="py-3">
        <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
        <p className={cn("mt-0.5 text-2xl tabular-nums", tones[tone])}>{value}</p>
        {hint ? <p className="text-[11px] text-ink-faint">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

/** Deep-links a finding to the screen where it can actually be fixed. */
function FindingLink({
  projectId,
  entityType,
  entityId,
  label,
  model,
}: {
  projectId: string;
  entityType: string;
  entityId: string;
  label: string;
  model: NonNullable<Awaited<ReturnType<typeof loadProjectModel>>>;
}) {
  let href: string | null = null;

  if (entityType === "requirement") {
    href = `/projects/${projectId}/requirements/${entityId}`;
  } else if (entityType === "use_case") {
    const useCase = model.useCases.find((u) => u.id === entityId);
    href = useCase?.requirementId
      ? `/projects/${projectId}/requirements/${useCase.requirementId}`
      : `/projects/${projectId}/requirements?view=use-cases`;
  } else if (entityType === "acceptance_criterion") {
    const criterion = model.acceptanceCriteria.find((a) => a.id === entityId);
    href = criterion?.requirementId
      ? `/projects/${projectId}/requirements/${criterion.requirementId}`
      : `/projects/${projectId}/requirements?view=criteria`;
  } else if (entityType === "business_rule") {
    href = `/projects/${projectId}/requirements?view=rules`;
  } else if (
    entityType === "stakeholder" ||
    entityType === "actor" ||
    entityType === "business_goal"
  ) {
    href = `/projects/${projectId}/requirements?view=context`;
  }

  if (!href) return <Ref className="mr-1.5">{label}</Ref>;

  return (
    <Link
      href={href}
      className="mr-1.5 font-mono text-xs text-accent underline underline-offset-2"
    >
      {label}
    </Link>
  );
}

function buildRefLabels(
  model: NonNullable<Awaited<ReturnType<typeof loadProjectModel>>>,
): Map<string, string> {
  const map = new Map<string, string>();
  model.requirements.forEach((r) => map.set(r.id, r.ref));
  model.useCases.forEach((u) => map.set(u.id, u.ref));
  model.acceptanceCriteria.forEach((a) => map.set(a.id, a.ref));
  return map;
}
