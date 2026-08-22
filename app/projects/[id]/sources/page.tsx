import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, listSourceDocuments } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";
import { formatDate, formatDateTime, pluralize, truncate, wordCount } from "@/lib/utils";
import { currentUserCan } from "@/lib/auth/access";
import { displayName, displayNameOr } from "@/lib/auth/display-name";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
} from "@/components/ui";
import {
  SourceProvenanceBadge,
  SourceTypeBadge,
  RoleBadge,
  ValidationStatusBadge,
} from "@/components/ui/badges";
import { SourceComposer } from "@/components/sources/source-composer";
import { SourceValidationControl } from "@/components/sources/source-validation-control";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sources" };

export default async function SourcesPage({
  params,
}: PageProps<"/projects/[id]/sources">) {
  const { id } = await params;
  const [project, sources] = await Promise.all([
    getProject(id),
    listSourceDocuments(id),
  ]);
  if (!project) notFound();

  // Which sources have already been through extraction — the analyst needs to
  // know what is new since the last run before deciding to re-run it.
  const canValidate = await currentUserCan(id, "validate_sources");

  const extractedCounts = await prisma.extractedInsight.groupBy({
    by: ["sourceDocumentId"],
    where: { projectId: id },
    _count: { _all: true },
  });
  const insightsBySource = new Map(
    extractedCounts.map((row) => [row.sourceDocumentId, row._count._all]),
  );

  const totalWords = sources.reduce((sum, s) => sum + wordCount(s.content), 0);
  const unvalidated = sources.filter((s) => s.validationStatus === "pending").length;
  const rejected = sources.filter((s) => s.validationStatus === "rejected").length;

  return (
    <>
      <PageHeader
        title="Sources"
        description="Raw discovery material, stored verbatim. Everything the AI extracts stays traceable back to one of these."
        actions={
          sources.length > 0 ? (
            <ButtonLink href={`/projects/${id}/extraction`} variant="primary">
              Go to extraction
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {/* Keyed by source count: a successful add remounts a clean composer. */}
        <SourceComposer key={sources.length} projectId={id} />

        {sources.length === 0 ? (
          <EmptyState
            title="No sources yet"
            description="Paste your first piece of discovery material above — workshop notes, a call transcript, an email thread or a feature brief."
          />
        ) : (
          <section>
            <SectionTitle count={sources.length} className="mb-2">
              Stored sources
            </SectionTitle>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {sources.map((source) => {
                  const insightCount = insightsBySource.get(source.id) ?? 0;
                  return (
                    <li key={source.id}>
                      <Link
                        href={`/projects/${id}/sources/${source.id}`}
                        className="block px-5 pb-2.5 pt-3.5 transition-colors hover:bg-surface-muted"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {source.title}
                          </span>
                          <SourceTypeBadge type={source.sourceType} />
                          <SourceProvenanceBadge
                            provenance={source.sourceProvenance}
                            sourceType={source.sourceType}
                          />
                          <ValidationStatusBadge status={source.validationStatus} />
                          {insightCount === 0 ? (
                            <span className="text-[11px] text-warning">
                              not extracted
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-faint">
                              {pluralize(insightCount, "insight")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed text-ink-muted">
                          {truncate(source.content, 260)}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-faint">
                          <span>
                            {wordCount(source.content).toLocaleString()} words ·{" "}
                            {source.sourceTimestamp
                              ? `written ${formatDate(source.sourceTimestamp)} · added `
                              : "added "}
                            {formatDateTime(source.createdAt)}
                          </span>
                          {source.uploadedBy ? (
                            <>
                              <span>by {displayName(source.uploadedBy)}</span>
                              {source.uploaderRole ? (
                                <RoleBadge role={source.uploaderRole} />
                              ) : null}
                            </>
                          ) : (
                            <span className="text-warning">uploader unknown</span>
                          )}
                        </p>
                      </Link>

                      {/* Outside the link: a form cannot be nested in an anchor,
                          and deciding must not navigate. */}
                      <div className="px-5 pb-3.5">
                        {source.validationStatus === "validated" ? (
                          <p className="text-[11px] text-positive">
                            Validated by {displayNameOr(source.validatedBy, "a former member")}
                            {source.validatedAt
                              ? ` on ${formatDate(source.validatedAt)}`
                              : null}
                            {source.validationNotes.length > 0
                              ? ` — ${truncate(source.validationNotes, 120)}`
                              : null}
                          </p>
                        ) : source.validationStatus === "rejected" ? (
                          <p className="text-[11px] text-critical">
                            Rejected by {displayNameOr(source.validatedBy, "a former member")}
                            {source.validatedAt
                              ? ` on ${formatDate(source.validatedAt)}`
                              : null}
                            {source.validationNotes.length > 0
                              ? `: ${truncate(source.validationNotes, 160)}`
                              : null}
                          </p>
                        ) : canValidate ? (
                          <SourceValidationControl
                            projectId={id}
                            sourceId={source.id}
                            compact
                          />
                        ) : (
                          <p className="text-[11px] text-ink-faint">
                            Waiting on an owner, PM or architect to validate it.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <p className="mt-2 text-xs text-ink-faint">
              {pluralize(sources.length, "source")} · {totalWords.toLocaleString()} words
              total
              {unvalidated > 0 ? (
                <>
                  {" · "}
                  <span className="text-warning">{unvalidated} not validated</span>
                </>
              ) : null}
              {rejected > 0 ? (
                <>
                  {" · "}
                  <span className="text-critical">
                    {pluralize(rejected, "rejected source")}
                  </span>
                </>
              ) : null}
            </p>
          </section>
        )}
      </div>
    </>
  );
}
