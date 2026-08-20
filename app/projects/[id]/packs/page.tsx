import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPackOutput,
  listPackOutputs,
  loadProjectModel,
} from "@/lib/db/queries";
import { isAiConfigured } from "@/lib/ai/client";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import { ModeBadge } from "@/components/ui/badges";
import { PackGenerator, type PackReadiness } from "@/components/packs/pack-generator";
import { PackPreview } from "@/components/packs/pack-preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packs" };

export default async function PacksPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/packs">) {
  const { id } = await params;
  const query = await searchParams;
  const selectedId = typeof query.pack === "string" ? query.pack : undefined;
  const narrativeMissing = query.narrative === "missing";

  const [model, packs] = await Promise.all([
    loadProjectModel(id),
    listPackOutputs(id),
  ]);
  if (!model) notFound();

  const selected = selectedId
    ? await getPackOutput(selectedId)
    : packs.length > 0
      ? await getPackOutput(packs[0].id)
      : null;

  const readiness: PackReadiness = {
    requirements: model.requirements.length,
    useCasesHighLevel: model.useCases.filter((u) => u.scopeLevel === "high_level").length,
    useCasesDetailed: model.useCases.filter((u) => u.scopeLevel === "detailed").length,
    businessCriteria: model.acceptanceCriteria.filter(
      (a) => a.criterionType === "business",
    ).length,
    functionalCriteria: model.acceptanceCriteria.filter(
      (a) => a.criterionType !== "business",
    ).length,
    stakeholders: model.stakeholders.length,
    goals: model.businessGoals.length,
    rules: model.businessRules.length,
    pendingInsights: model.insights.filter((i) => i.status === "pending").length,
  };

  return (
    <>
      <PageHeader
        title="Packs"
        description="Both pack types are generated from the same requirement model. Nothing in a pack is invented — the lists are your entities, verbatim."
        actions={
          selected ? (
            <ButtonLink href={`/projects/${id}/export?pack=${selected.id}`}>
              Export
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="space-y-5">
        <PackGenerator
          projectId={id}
          defaultMode={model.project.defaultMode}
          aiConfigured={isAiConfigured()}
          readiness={readiness}
        />

        {narrativeMissing ? (
          <p className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning">
            Pack assembled from your model. The narrative sections were not written —
            set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> and
            regenerate them individually from the section list.
          </p>
        ) : null}

        {packs.length > 1 ? (
          <section>
            <SectionTitle count={packs.length} className="mb-2">
              Generated packs
            </SectionTitle>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {packs.map((pack) => (
                  <li key={pack.id}>
                    <Link
                      href={`/projects/${id}/packs?pack=${pack.id}`}
                      className={cn(
                        "flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-surface-muted",
                        pack.id === selected?.id && "bg-accent-soft/50",
                      )}
                    >
                      <ModeBadge mode={pack.mode} />
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {pack.title}
                      </span>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {formatDateTime(pack.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        {selected ? (
          <PackPreview
            projectId={id}
            pack={{
              id: selected.id,
              mode: selected.mode,
              title: selected.title,
              html: selected.htmlContent,
              markdown: selected.markdownContent,
              json: selected.jsonContent,
            }}
          />
        ) : (
          <EmptyState
            title="No packs generated yet"
            description="Pick a mode above and generate one. You can generate both — they are built from the same model and stay independent."
          />
        )}
      </div>
    </>
  );
}
