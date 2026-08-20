import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPackOutput,
  listPackOutputs,
  loadProjectModel,
} from "@/lib/db/queries";
import { runDeterministicChecks } from "@/lib/quality/deterministic";
import { cn, formatDateTime } from "@/lib/utils";
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { ModeBadge } from "@/components/ui/badges";
import { CopyButton } from "@/components/packs/pack-preview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export" };

export default async function ExportPage({
  params,
  searchParams,
}: PageProps<"/projects/[id]/export">) {
  const { id } = await params;
  const query = await searchParams;
  const selectedId = typeof query.pack === "string" ? query.pack : undefined;

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

  const report = runDeterministicChecks(model);

  return (
    <>
      <PageHeader
        title="Export"
        description="Markdown for anywhere text goes; print-friendly HTML for a PDF or an email attachment. Both are rendered from the same pack JSON, so they always say the same thing."
        actions={
          <ButtonLink href={`/projects/${id}/packs`}>Back to packs</ButtonLink>
        }
      />

      {packs.length === 0 ? (
        <EmptyState
          title="Nothing to export yet"
          description="Generate a pack first — export always works from a generated pack, never straight from the model, so what you send is exactly what you reviewed."
          action={
            <ButtonLink href={`/projects/${id}/packs`} variant="primary">
              Generate a pack
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-5">
          {packs.length > 1 ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Choose a pack</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-line">
                {packs.map((pack) => (
                  <li key={pack.id}>
                    <Link
                      href={`/projects/${id}/export?pack=${pack.id}`}
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
          ) : null}

          {selected ? (
            <>
              {report.counts.critical > 0 ? (
                <p className="rounded-md border border-critical-line bg-critical-soft px-3 py-2 text-sm text-critical">
                  {report.counts.critical} critical quality finding
                  {report.counts.critical === 1 ? "" : "s"} in the current model.{" "}
                  <Link
                    href={`/projects/${id}/quality`}
                    className="underline underline-offset-2"
                  >
                    Review them
                  </Link>{" "}
                  before sending this out — this pack was generated from that model.
                </p>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle>{selected.title}</CardTitle>
                  <span className="text-xs text-ink-faint">
                    Generated {formatDateTime(selected.createdAt)}
                  </span>
                </CardHeader>
                <CardBody className="space-y-5">
                  <ExportRow
                    title="Markdown"
                    description="Paste into Confluence, Notion, a Git repo or a ticket. Tables, headings and reference codes survive intact."
                    href={`/projects/${id}/export/download?pack=${selected.id}&format=md`}
                    copyValue={selected.markdownContent}
                    size={selected.markdownContent.length}
                  />

                  <ExportRow
                    title="Print-friendly HTML"
                    description="A single self-contained file — no external stylesheet, fonts or scripts. Open it and print to PDF, or attach it to an email as is."
                    href={`/projects/${id}/export/download?pack=${selected.id}&format=html`}
                    copyValue={selected.htmlContent}
                    size={selected.htmlContent.length}
                  />

                  <ExportRow
                    title="Pack JSON"
                    description="The structured pack the other two formats are rendered from. Every item carries its reference code and source ids — useful for feeding another tool."
                    href={`/projects/${id}/export/download?pack=${selected.id}&format=json`}
                    copyValue={selected.jsonContent}
                    size={selected.jsonContent.length}
                  />
                </CardBody>
              </Card>

              <p className="text-xs leading-relaxed text-ink-faint">
                Exports are snapshots. Editing the requirement model does not change a
                pack that has already been generated — regenerate the pack to pick up
                your edits, then export again.
              </p>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

function ExportRow({
  title,
  description,
  href,
  copyValue,
  size,
}: {
  title: string;
  description: string;
  href: string;
  copyValue: string;
  size: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5 last:border-0 last:pb-0">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        <p className="mt-1 text-[11px] tabular-nums text-ink-faint">
          {(size / 1024).toFixed(1)} KB
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <CopyButton value={copyValue} label="Copy" />
        <ButtonLink href={href} variant="primary" download>
          Download
        </ButtonLink>
      </div>
    </div>
  );
}
