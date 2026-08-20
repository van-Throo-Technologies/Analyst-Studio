import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProjectModel } from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/ai/client";
import { runDeterministicChecks } from "@/lib/quality/deterministic";
import { formatDateTime } from "@/lib/utils";
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Ref,
} from "@/components/ui";
import { SeverityBadge } from "@/components/ui/badges";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { UseCasePanel } from "@/components/requirements/use-case-panel";
import { CriteriaPanel } from "@/components/requirements/criteria-panel";
import {
  DraftCriteriaButton,
  DraftUseCaseButton,
} from "@/components/requirements/draft-buttons";
import { DeleteRequirementButton } from "@/components/requirements/delete-requirement-button";

export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({
  params,
}: PageProps<"/projects/[id]/requirements/[requirementId]">) {
  const { id, requirementId } = await params;

  const model = await loadProjectModel(id);
  if (!model) notFound();

  const requirement = model.requirements.find((r) => r.id === requirementId);
  if (!requirement) notFound();

  const useCases = model.useCases.filter((u) => u.requirementId === requirementId);
  const criteria = model.acceptanceCriteria.filter(
    (a) => a.requirementId === requirementId,
  );
  const dependencies = model.dependencies.filter(
    (d) => d.fromRequirementId === requirementId || d.toRequirementId === requirementId,
  );

  const sources = model.sourceDocuments.map((s) => ({
    id: s.id,
    title: s.title,
    sourceType: s.sourceType,
  }));
  const requirementOptions = model.requirements.map((r) => ({
    id: r.id,
    ref: r.ref,
    title: r.title,
  }));

  // Show only the findings that concern this requirement and its children, so
  // the analyst can fix them without leaving the page.
  const relatedIds = new Set([
    requirementId,
    ...useCases.map((u) => u.id),
    ...criteria.map((c) => c.id),
  ]);
  const findings = runDeterministicChecks(model).findings.filter((f) =>
    relatedIds.has(f.entityId),
  );

  const mode = model.project.defaultMode;
  const aiReady = isAiConfigured();
  const refsById = new Map(model.requirements.map((r) => [r.id, r.ref]));

  return (
    <>
      <PageHeader
        title={requirement.title}
        description={`${requirement.ref} · last edited ${formatDateTime(requirement.updatedAt)}`}
        actions={
          <>
            <ButtonLink href={`/projects/${id}/requirements`}>
              Back to model
            </ButtonLink>
            <DeleteRequirementButton
              projectId={id}
              requirementId={requirementId}
              useCaseCount={useCases.length}
              criteriaCount={criteria.length}
            />
          </>
        }
      />

      <div className="space-y-8">
        {findings.length > 0 ? (
          <Card className="border-warning-line">
            <CardHeader className="border-warning-line">
              <CardTitle>Quality checks on this requirement</CardTitle>
              <span className="text-xs text-ink-faint">
                {findings.length} finding{findings.length === 1 ? "" : "s"}
              </span>
            </CardHeader>
            <ul className="divide-y divide-line">
              {findings.map((finding) => (
                <li key={finding.id} className="flex gap-3 px-5 py-2.5">
                  <SeverityBadge severity={finding.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <Ref className="mr-1.5">{finding.entityLabel}</Ref>
                      {finding.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {finding.explanation}
                    </p>
                    <p className="mt-0.5 text-xs text-accent">{finding.suggestedFix}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Requirement</CardTitle>
            <Ref>{requirement.ref}</Ref>
          </CardHeader>
          <CardBody>
            <RequirementForm
              projectId={id}
              requirement={requirement}
              sources={sources}
            />
          </CardBody>
        </Card>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Use cases</h2>
            <DraftUseCaseButton
              projectId={id}
              requirementId={requirementId}
              mode={mode}
              disabled={!aiReady}
            />
          </div>
          <UseCasePanel
            projectId={id}
            useCases={useCases}
            requirements={requirementOptions}
            sources={sources}
            scopedRequirementId={requirementId}
          />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Acceptance criteria</h2>
            <DraftCriteriaButton
              projectId={id}
              requirementId={requirementId}
              mode={mode}
              disabled={!aiReady}
            />
          </div>
          <CriteriaPanel
            projectId={id}
            criteria={criteria}
            requirements={requirementOptions}
            sources={sources}
            scopedRequirementId={requirementId}
          />
        </section>

        {dependencies.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Dependencies</CardTitle>
              <Link
                href={`/projects/${id}/requirements?view=dependencies`}
                className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                Manage all
              </Link>
            </CardHeader>
            <ul className="divide-y divide-line">
              {dependencies.map((dependency) => {
                const outgoing = dependency.fromRequirementId === requirementId;
                const otherId = outgoing
                  ? dependency.toRequirementId
                  : dependency.fromRequirementId;
                return (
                  <li key={dependency.id} className="px-5 py-2.5 text-sm text-ink-soft">
                    {outgoing ? "This" : refsById.get(otherId)}{" "}
                    <span className="text-ink-muted">
                      {dependency.dependencyType.replace(/_/g, " ")}
                    </span>{" "}
                    {outgoing ? refsById.get(otherId) : "this"}
                    {dependency.notes ? (
                      <span className="text-xs text-ink-faint"> — {dependency.notes}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {!aiReady ? (
          <p className="text-xs text-ink-faint">
            Drafting is disabled because no API key is configured. Everything here can
            still be written by hand.
          </p>
        ) : null}
      </div>
    </>
  );
}
