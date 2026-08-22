import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceDocument } from "@/lib/db/queries";
import { prisma } from "@/lib/db/client";
import { toExtractedInsight } from "@/lib/db/mappers";
import { formatDate, formatDateTime, pluralize } from "@/lib/utils";
import { currentUserCan } from "@/lib/auth/access";
import { displayName } from "@/lib/auth/display-name";
import { shortChecksum } from "@/lib/intake/checksum";
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DetailRow,
  PageHeader,
} from "@/components/ui";
import { INSIGHT_TYPE_LABELS, SOURCE_PROVENANCE_LABELS } from "@/lib/schemas/enums";
import {
  InsightStatusBadge,
  SourceProvenanceBadge,
  SourceTypeBadge,
  ValidationStatusBadge,
} from "@/components/ui/badges";
import { SourceComposer } from "@/components/sources/source-composer";
import { SourceValidation } from "@/components/sources/source-validation";
import { DeleteSourceButton } from "@/components/sources/delete-source-button";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: PageProps<"/projects/[id]/sources/[sourceId]">) {
  const { id, sourceId } = await params;
  const source = await getSourceDocument(sourceId);
  if (!source || source.projectId !== id) notFound();

  const [insightRows, canValidate] = await Promise.all([
    prisma.extractedInsight.findMany({
      where: { sourceDocumentId: sourceId },
      orderBy: { createdAt: "asc" },
    }),
    currentUserCan(id, "validate_sources"),
  ]);
  const insights = insightRows.map(toExtractedInsight);

  return (
    <>
      <PageHeader
        title={source.title}
        description={`Added ${formatDateTime(source.createdAt)}`}
        actions={
          <>
            <ButtonLink href={`/projects/${id}/sources`}>Back to sources</ButtonLink>
            <DeleteSourceButton
              projectId={id}
              sourceId={sourceId}
              insightCount={insights.length}
            />
          </>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
            <div className="flex items-center gap-1.5">
              <SourceTypeBadge type={source.sourceType} />
              <SourceProvenanceBadge
                provenance={source.sourceProvenance}
                sourceType={source.sourceType}
              />
              <ValidationStatusBadge status={source.validationStatus} />
            </div>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-line">
              <DetailRow label="Where it came from">
                {SOURCE_PROVENANCE_LABELS[source.sourceProvenance]}
              </DetailRow>
              <DetailRow label="Written">
                {source.sourceTimestamp ? (
                  formatDate(source.sourceTimestamp)
                ) : (
                  <span className="text-ink-faint">Unknown</span>
                )}
              </DetailRow>
              <DetailRow label="Added by">
                {source.uploadedBy ? (
                  <>
                    {displayName(source.uploadedBy)}
                    {source.uploaderRole ? (
                      <span className="text-ink-faint">
                        {" "}
                        · {source.uploaderRole} at the time
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-warning">Uploader unknown</span>
                )}
              </DetailRow>
              <DetailRow label="Content fingerprint">
                {source.checksumHash ? (
                  <span
                    className="font-mono text-xs"
                    title={`SHA-256 ${source.checksumHash}`}
                  >
                    {shortChecksum(source.checksumHash)}
                  </span>
                ) : (
                  <span className="text-ink-faint">Not computed — predates checksums</span>
                )}
              </DetailRow>
            </dl>
          </CardBody>
        </Card>

        <SourceValidation
          projectId={id}
          source={source}
          canValidate={canValidate}
        />

        <SourceComposer projectId={id} source={source} />

        <Card>
          <CardHeader>
            <CardTitle>Extracted from this source</CardTitle>
            <span className="text-xs text-ink-faint">
              {pluralize(insights.length, "insight")}
            </span>
          </CardHeader>
          {insights.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-muted">
                Nothing extracted from this source yet.{" "}
                <Link
                  href={`/projects/${id}/extraction`}
                  className="underline underline-offset-2 hover:text-ink"
                >
                  Run extraction
                </Link>
                .
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {insights.map((insight) => (
                <li key={insight.id} className="flex gap-3 px-5 py-2.5">
                  <span className="w-40 shrink-0 text-xs text-ink-faint">
                    {INSIGHT_TYPE_LABELS[insight.insightType]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink-soft">
                    {insight.normalizedText}
                  </span>
                  <InsightStatusBadge status={insight.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
