import Link from "next/link";
import type { Requirement } from "@/lib/schemas/entities";
import { Card, EmptyState, Ref } from "@/components/ui";
import {
  PriorityBadge,
  RequirementStatusBadge,
  RequirementTypeBadge,
} from "@/components/ui/badges";
import { NewRequirementCard } from "@/components/requirements/requirement-form";
import type { SourceOption } from "@/components/requirements/source-picker";

/**
 * Requirements list, ordered by priority then ref. Each row shows the counts
 * that matter for readiness — use cases and criteria — so gaps are visible
 * without opening anything.
 */
export function RequirementList({
  projectId,
  requirements,
  sources,
  useCaseCounts,
  criteriaCounts,
}: {
  projectId: string;
  requirements: Requirement[];
  sources: SourceOption[];
  useCaseCounts: Map<string, number>;
  criteriaCounts: Map<string, number>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Requirements</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">
            The spine of the model. Both pack types are generated from these, so
            everything here shows up in an export exactly as written.
          </p>
        </div>
        <NewRequirementCard projectId={projectId} sources={sources} />
      </div>

      {requirements.length === 0 ? (
        <EmptyState
          title="No requirements yet"
          description="Promote candidate requirements from extraction, or add one directly above."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {requirements.map((requirement) => {
              const useCases = useCaseCounts.get(requirement.id) ?? 0;
              const criteria = criteriaCounts.get(requirement.id) ?? 0;
              return (
                <li key={requirement.id}>
                  <Link
                    href={`/projects/${projectId}/requirements/${requirement.id}`}
                    className="flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-surface-muted"
                  >
                    <Ref className="w-16 shrink-0 pt-0.5">{requirement.ref}</Ref>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{requirement.title}</p>
                      {requirement.description ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
                          {requirement.description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={requirement.priority} />
                        <RequirementTypeBadge type={requirement.requirementType} />
                        <RequirementStatusBadge status={requirement.status} />
                        {requirement.sourceRefs.length === 0 ? (
                          <span className="text-[11px] text-warning">no source</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="hidden shrink-0 gap-5 text-right text-xs sm:flex">
                      <span
                        className={
                          useCases === 0 ? "text-ink-faint" : "text-ink-soft"
                        }
                      >
                        {useCases} use case{useCases === 1 ? "" : "s"}
                      </span>
                      <span
                        className={criteria === 0 ? "text-warning" : "text-ink-soft"}
                      >
                        {criteria} criteri{criteria === 1 ? "on" : "a"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
