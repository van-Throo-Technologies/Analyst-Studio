import { notFound } from "next/navigation";
import Link from "next/link";
import { getProject, listInsights, listSourceDocuments } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";
import { isAiConfigured } from "@/lib/ai/client";
import { canExtractProject } from "@/lib/extraction/gate";
import { displayName } from "@/lib/auth/display-name";
import { severitySchema } from "@/lib/schemas/enums";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { ExtractionRunner } from "@/components/extraction/extraction-runner";
import { ExtractionReadinessPanel } from "@/components/extraction/extraction-readiness";
import { ExtractionFindings } from "@/components/extraction/extraction-findings";
import { InsightReview } from "@/components/extraction/insight-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Extraction" };

export default async function ExtractionPage({
  params,
}: PageProps<"/projects/[id]/extraction">) {
  const { id } = await params;
  const [project, sources, insights, readiness, findingRows] = await Promise.all([
    getProject(id),
    listSourceDocuments(id),
    listInsights(id),
    canExtractProject(id),
    prisma.aiFinding.findMany({
      where: { projectId: id, job: "source_extraction", status: "open" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!project) notFound();

  // Findings point at insight ids; resolve them so a finding reads as being
  // about something rather than about a row.
  const insightText = new Map(insights.map((i) => [i.id, i.normalizedText]));
  const findings = findingRows.map((row) => ({
    id: row.id,
    severity: severitySchema.catch("info").parse(row.severity),
    title: row.title,
    explanation: row.explanation,
    suggestedFix: row.suggestedFix,
    insightText: insightText.get(row.entityId) ?? null,
  }));

  const sourcesForReview = sources.map((s) => ({
    id: s.id,
    title: s.title,
    uploadedByName: s.uploadedBy ? displayName(s.uploadedBy) : null,
    uploaderRole: s.uploaderRole,
    validatedAt: s.validatedAt,
  }));

  const extractedSourceIds = new Set(insights.map((i) => i.sourceDocumentId));

  return (
    <>
      <PageHeader
        title="Extraction"
        description="AI reads each source and proposes structured insights. Nothing enters the requirement model until you accept it."
        actions={
          <ButtonLink href={`/projects/${id}/requirements`}>
            Requirement model
          </ButtonLink>
        }
      />

      {sources.length === 0 ? (
        <EmptyState
          title="No sources to extract from"
          description="Extraction reads the discovery material you have stored. Add at least one source first."
          action={
            <ButtonLink href={`/projects/${id}/sources`} variant="primary">
              Add a source
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          <ExtractionReadinessPanel projectId={id} readiness={readiness} />

          <ExtractionRunner
            projectId={id}
            defaultMode={project.defaultMode}
            aiConfigured={isAiConfigured()}
            canExtract={readiness.canExtract}
            sources={sources.map((s) => ({
              id: s.id,
              title: s.title,
              sourceType: s.sourceType,
              validationStatus: s.validationStatus,
              extracted: extractedSourceIds.has(s.id),
            }))}
          />

          <ExtractionFindings projectId={id} findings={findings} />

          {insights.length === 0 ? (
            <EmptyState
              title="Nothing extracted yet"
              description="Pick the sources you want to read and run extraction. You can re-run at any time — anything you have already reviewed is left untouched."
            />
          ) : (
            <InsightReview
              projectId={id}
              insights={insights}
              sources={sourcesForReview}
            />
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-ink-faint">
        Every run is recorded with its model, prompt version and raw output.{" "}
        <Link
          href={`/projects/${id}/quality`}
          className="underline underline-offset-2 hover:text-ink-soft"
        >
          See the generation log
        </Link>
        .
      </p>
    </>
  );
}
