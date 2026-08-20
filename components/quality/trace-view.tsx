import Link from "next/link";
import type { TraceGraph, TraceNode } from "@/lib/trace/graph";
import { cn, truncate } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle, Ref } from "@/components/ui";

/**
 * Traceability view.
 *
 * One row per requirement, showing the chain the product promises:
 * source → requirement → use case → acceptance criterion → pack.
 * Gaps are rendered as gaps, not hidden — a requirement with no source and no
 * criteria should look conspicuously empty, because it is.
 */
export function TraceView({
  projectId,
  graph,
}: {
  projectId: string;
  graph: TraceGraph;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traceability</CardTitle>
        <span className="text-xs text-ink-faint">
          {graph.totals.sourcedRequirements} of {graph.totals.requirements}{" "}
          requirements trace back to a source
        </span>
      </CardHeader>

      {graph.chains.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-muted">
            Nothing to trace yet. Chains appear once there are requirements.
          </p>
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="w-1/5 px-5 py-2 font-medium">Source</th>
                <th className="w-1/4 px-3 py-2 font-medium">Requirement</th>
                <th className="w-1/5 px-3 py-2 font-medium">Use cases</th>
                <th className="w-1/4 px-3 py-2 font-medium">Acceptance criteria</th>
                <th className="px-5 py-2 font-medium">Packs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {graph.chains.map((chain) => (
                <tr key={chain.requirement.id}>
                  <td className="px-5 py-3">
                    {chain.sources.length === 0 ? (
                      <span className="text-xs text-critical">no source</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {chain.sources.map((source) => (
                          <li key={source.id}>
                            <Link
                              href={`/projects/${projectId}/sources/${source.id}`}
                              className="text-xs text-ink-soft underline-offset-2 hover:underline"
                            >
                              {truncate(source.label, 40)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <Link
                      href={`/projects/${projectId}/requirements/${chain.requirement.id}`}
                      className="block"
                    >
                      <Ref className="text-accent">{chain.requirement.label}</Ref>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {truncate(chain.requirement.detail, 70)}
                      </span>
                    </Link>
                  </td>

                  <td className="px-3 py-3">
                    <NodeList nodes={chain.useCases} emptyLabel="none" />
                  </td>

                  <td className="px-3 py-3">
                    <NodeList
                      nodes={chain.criteria}
                      emptyLabel="none"
                      emptyTone="warning"
                      showDetail
                    />
                  </td>

                  <td className="px-5 py-3 text-xs">
                    {chain.packIds.length === 0 ? (
                      <span className="text-ink-faint">not yet in a pack</span>
                    ) : (
                      <Link
                        href={`/projects/${projectId}/packs?pack=${chain.packIds[0]}`}
                        className="text-ink-soft underline-offset-2 hover:underline"
                      >
                        {chain.packIds.length} pack
                        {chain.packIds.length === 1 ? "" : "s"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(graph.unusedSources.length > 0 ||
        graph.orphanUseCases.length > 0 ||
        graph.orphanCriteria.length > 0) && (
        <CardBody className="border-t border-line bg-surface-muted">
          <div className="grid gap-4 sm:grid-cols-3">
            <Gap
              title="Sources not yet used"
              nodes={graph.unusedSources}
              note="Nothing in the model derives from these. Either extract from them or remove them."
            />
            <Gap
              title="Use cases with no requirement"
              nodes={graph.orphanUseCases}
              note="These will not appear under any requirement in a pack."
            />
            <Gap
              title="Criteria with no requirement"
              nodes={graph.orphanCriteria}
              note="A criterion that verifies nothing defines nothing."
            />
          </div>
        </CardBody>
      )}
    </Card>
  );
}

function NodeList({
  nodes,
  emptyLabel,
  emptyTone = "faint",
  showDetail,
}: {
  nodes: TraceNode[];
  emptyLabel: string;
  emptyTone?: "faint" | "warning";
  showDetail?: boolean;
}) {
  if (nodes.length === 0) {
    return (
      <span
        className={cn(
          "text-xs",
          emptyTone === "warning" ? "text-warning" : "text-ink-faint",
        )}
      >
        {emptyLabel}
      </span>
    );
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id} className="text-xs">
          <Ref>{node.label}</Ref>
          {showDetail ? (
            <span className="ml-1.5 text-ink-muted">{truncate(node.detail, 44)}</span>
          ) : (
            <span className="ml-1.5 text-ink-soft">{truncate(node.detail, 34)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Gap({
  title,
  nodes,
  note,
}: {
  title: string;
  nodes: TraceNode[];
  note: string;
}) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-warning">
        {title} ({nodes.length})
      </p>
      <ul className="mt-1 space-y-0.5">
        {nodes.map((node) => (
          <li key={node.id} className="text-xs text-ink-soft">
            {truncate(node.label, 48)}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11px] text-ink-faint">{note}</p>
    </div>
  );
}
