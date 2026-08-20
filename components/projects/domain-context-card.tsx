import Link from "next/link";
import type { DomainProfile, Project } from "@/lib/schemas/entities";
import {
  INDUSTRY_LABELS,
  JURISDICTION_LABELS,
  REGULATORY_SENSITIVITY_HINTS,
  REGULATORY_SENSITIVITY_LABELS,
} from "@/lib/schemas/enums";
import { Card, CardBody, CardHeader, CardTitle, DetailRow } from "@/components/ui";
import { RegulatorySensitivityBadge } from "@/components/ui/badges";

/**
 * Read-only view of a project's domain context.
 *
 * Unanswered fields are shown as "Not set" rather than hidden — a visible gap
 * is a prompt to fill it in, whereas a collapsed row just looks complete.
 */
export function DomainContextCard({
  project,
  profile,
}: {
  project: Project;
  profile: DomainProfile | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Domain context</CardTitle>
        <RegulatorySensitivityBadge
          sensitivity={project.regulatorySensitivity}
        />
      </CardHeader>
      <CardBody>
        <dl className="divide-y divide-line">
          <DetailRow label="Industry">
            {INDUSTRY_LABELS[project.industry]}
          </DetailRow>
          <DetailRow label="Subdomain">
            {project.subdomain ?? <NotSet />}
          </DetailRow>
          <DetailRow label="Jurisdiction">
            {project.jurisdiction ? (
              JURISDICTION_LABELS[project.jurisdiction]
            ) : (
              <NotSet />
            )}
          </DetailRow>
          <DetailRow label="Regulatory">
            <span title={REGULATORY_SENSITIVITY_HINTS[project.regulatorySensitivity]}>
              {REGULATORY_SENSITIVITY_LABELS[project.regulatorySensitivity]}
            </span>
          </DetailRow>
          <DetailRow label="Solution domain">
            {project.solutionDomain ?? <NotSet />}
          </DetailRow>
          {project.domainContext ? (
            <DetailRow label="Notes">{project.domainContext}</DetailRow>
          ) : null}
        </dl>

        {profile ? (
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">
            Prompt context:{" "}
            <span className="font-mono text-ink-muted">
              {profile.promptContextSummary}
            </span>
          </p>
        ) : (
          <p className="mt-3 border-t border-line pt-3 text-xs text-warning">
            No domain profile stored for this project. Saving settings will generate one.
          </p>
        )}

        <p className="mt-2 text-xs text-ink-faint">
          <Link
            href={`/projects/${project.id}/settings`}
            className="underline underline-offset-2 hover:text-ink-soft"
          >
            Edit in settings
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

function NotSet() {
  return <span className="text-ink-faint">Not set</span>;
}
