import Link from "next/link";
import type { ExtractionReadiness } from "@/lib/extraction/gate";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { pluralize } from "@/lib/utils";

/**
 * What extraction is waiting on, stated before the analyst picks anything.
 *
 * A disabled button with no explanation is the worst version of a gate — this
 * says which sources are holding it up and links straight to where they are
 * dealt with. When everything is validated it gets out of the way in one line.
 */
export function ExtractionReadinessPanel({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness: ExtractionReadiness;
}) {
  if (readiness.canExtract) {
    return (
      <p className="text-sm text-positive">
        {pluralize(readiness.validatedCount, "source")} validated, ready to extract.
      </p>
    );
  }

  return (
    <Card className="border-warning-line">
      <CardHeader>
        <CardTitle>Extraction is not ready to run</CardTitle>
        <span className="text-xs text-ink-faint">
          {readiness.validatedCount}/{readiness.totalCount} validated
        </span>
      </CardHeader>
      <CardBody className="space-y-2">
        <p className="text-sm text-ink-soft">
          Please validate all sources before extracting. Everything the model reads becomes
          a requirement someone will build from, so the material it reads has to be
          material someone has vouched for.
        </p>
        <ul className="space-y-1">
          {readiness.blockers.map((blocker) => (
            <li key={blocker} className="text-sm text-warning">
              {blocker}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          <Link
            href={`/projects/${projectId}/sources`}
            className="underline underline-offset-2 hover:text-ink"
          >
            Go to sources
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
