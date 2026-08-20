import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProjectModel } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";
import { formatDateTime, pluralize } from "@/lib/utils";
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from "@/components/ui";
import { ModeBadge } from "@/components/ui/badges";
import { DomainContextCard } from "@/components/projects/domain-context-card";
import { AuditTrailCard } from "@/components/projects/audit-trail-card";
import { TeamCard } from "@/components/projects/team-card";
import { getDomainProfile } from "@/lib/domain/profile";
import { listProjectAudit } from "@/lib/audit/log";
import { listProjectMembers } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SHOW_PHASE_3_PLUS_NAV } from "@/lib/phase-scope";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const model = await loadProjectModel(id);
  if (!model) notFound();

  const { project } = model;
  const packCount = await prisma.packOutput.count({ where: { projectId: id } });
  const pendingInsights = model.insights.filter((i) => i.status === "pending").length;

  const [domainProfile, auditEntries, members, currentUser] = await Promise.all([
    getDomainProfile(id),
    listProjectAudit(id, 8),
    listProjectMembers(id),
    getCurrentUser(),
  ]);

  // The overview's job is to answer "what do I do next?", so each step knows
  // whether it is done and where it goes.
  const allSteps = [
    {
      label: "Add discovery sources",
      done: model.sourceDocuments.length > 0,
      detail:
        model.sourceDocuments.length > 0
          ? pluralize(model.sourceDocuments.length, "source")
          : "Paste notes, transcripts or briefs",
      href: `/projects/${id}/sources`,
    },
    {
      label: "Run extraction and review",
      done: model.insights.length > 0 && pendingInsights === 0,
      detail:
        model.insights.length === 0
          ? "Not run yet"
          : pendingInsights > 0
            ? `${pendingInsights} awaiting review`
            : `${model.insights.length} reviewed`,
      href: `/projects/${id}/extraction`,
    },
    {
      label: "Build the requirement model",
      done: model.requirements.length > 0,
      detail:
        model.requirements.length > 0
          ? `${pluralize(model.requirements.length, "requirement")}, ${pluralize(model.useCases.length, "use case")}`
          : "No requirements yet",
      href: `/projects/${id}/requirements`,
    },
    {
      label: "Generate a pack",
      done: packCount > 0,
      detail: packCount > 0 ? pluralize(packCount, "pack") : "Not generated yet",
      href: `/projects/${id}/packs`,
    },
    {
      label: "Check quality and traceability",
      done: false,
      detail: "Deterministic checks run on demand",
      href: `/projects/${id}/quality`,
    },
    {
      label: "Export",
      done: false,
      detail: "Markdown or print-friendly HTML",
      href: `/projects/${id}/export`,
    },
  ];

  // Matches the sidebar: during a Phase 1-2 review the progress list stops at
  // intake rather than pointing at screens that are out of review scope.
  const steps = SHOW_PHASE_3_PLUS_NAV ? allSteps : allSteps.slice(0, 1);

  const nextStep = steps.find((s) => !s.done) ?? steps[steps.length - 1];

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description || undefined}
        actions={
          <ButtonLink href={nextStep.href} variant="primary">
            {nextStep.label}
          </ButtonLink>
        }
      />

      {/* items-start: with the progress list scoped down, a stretched card would
          leave a tall empty box. */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <span className="text-xs text-ink-faint">
              Updated {formatDateTime(project.updatedAt)}
            </span>
          </CardHeader>
          <ol className="divide-y divide-line">
            {steps.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={
                      step.done
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-positive-line bg-positive-soft text-[11px] text-positive"
                        : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-[11px] text-ink-faint"
                    }
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink">{step.label}</span>
                  <span className="shrink-0 text-xs text-ink-faint">{step.detail}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Framing</CardTitle>
              <ModeBadge mode={project.defaultMode} />
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Analysis goal">
                  {project.analysisGoal || (
                    <span className="text-ink-faint">Not set</span>
                  )}
                </DetailRow>
              </dl>
              <p className="mt-3 text-xs text-ink-faint">
                This framing is sent with every AI job.{" "}
                <Link
                  href={`/projects/${id}/settings`}
                  className="underline underline-offset-2 hover:text-ink-soft"
                >
                  Edit in settings
                </Link>
              </p>
            </CardBody>
          </Card>

          <TeamCard
            members={members}
            currentUserId={currentUser?.id ?? null}
            ownerId={project.ownerId}
          />

          <DomainContextCard project={project} profile={domainProfile} />

          <AuditTrailCard entries={auditEntries} />

          <Card>
            <CardHeader>
              <CardTitle>Model contents</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Count label="Sources" value={model.sourceDocuments.length} />
                <Count label="Insights" value={model.insights.length} />
                <Count label="Stakeholders" value={model.stakeholders.length} />
                <Count label="Actors" value={model.actors.length} />
                <Count label="Business goals" value={model.businessGoals.length} />
                <Count label="Business rules" value={model.businessRules.length} />
                <Count label="Requirements" value={model.requirements.length} />
                <Count label="Use cases" value={model.useCases.length} />
                <Count
                  label="Acceptance criteria"
                  value={model.acceptanceCriteria.length}
                />
                <Count label="Dependencies" value={model.dependencies.length} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
