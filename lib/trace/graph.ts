import type { ProjectModel } from "@/lib/schemas/entities";
import type { EntityType } from "@/lib/schemas/enums";

/**
 * The traceability graph.
 *
 * Built from two things: foreign keys and sourceRefs already stored on entities
 * (the implicit edges), and the TraceLink table (the explicit ones). Derived on
 * read rather than maintained as a separate structure, so it cannot drift out
 * of sync with the model it describes.
 *
 * The chain the product promises is source → requirement → use case →
 * acceptance criterion → pack section. `buildTraceChains` returns exactly that,
 * anchored on requirements, plus the orphans at each level.
 */

export type TraceNode = {
  type: EntityType;
  id: string;
  label: string;
  detail: string;
};

export type TraceChain = {
  requirement: TraceNode;
  sources: TraceNode[];
  useCases: TraceNode[];
  criteria: TraceNode[];
  packIds: string[];
  /** True when nothing upstream justifies this requirement. */
  unsourced: boolean;
};

export type TraceGraph = {
  chains: TraceChain[];
  /** Sources nothing has been derived from. */
  unusedSources: TraceNode[];
  /** Use cases and criteria with no parent requirement. */
  orphanUseCases: TraceNode[];
  orphanCriteria: TraceNode[];
  /** Entities that are not requirements but do carry source lineage. */
  contextNodes: TraceNode[];
  totals: {
    sources: number;
    coveredSources: number;
    requirements: number;
    sourcedRequirements: number;
  };
};

export function buildTraceGraph(model: ProjectModel): TraceGraph {
  const sourceById = new Map(model.sourceDocuments.map((s) => [s.id, s]));

  const sourceNode = (id: string): TraceNode | null => {
    const source = sourceById.get(id);
    if (!source) return null;
    return {
      type: "source_document",
      id: source.id,
      label: source.title,
      detail: source.sourceType.replace(/_/g, " "),
    };
  };

  const packLinks = new Map<string, string[]>();
  for (const link of model.traceLinks) {
    if (link.toEntityType !== "pack_section") continue;
    const list = packLinks.get(link.fromEntityId) ?? [];
    list.push(link.toEntityId);
    packLinks.set(link.fromEntityId, list);
  }

  const chains: TraceChain[] = model.requirements.map((requirement) => {
    const sources = requirement.sourceRefs
      .map(sourceNode)
      .filter((n): n is TraceNode => n !== null);

    const useCases = model.useCases
      .filter((u) => u.requirementId === requirement.id)
      .map((u) => ({
        type: "use_case" as const,
        id: u.id,
        label: u.ref,
        detail: u.title,
      }));

    const criteria = model.acceptanceCriteria
      .filter((a) => a.requirementId === requirement.id)
      .map((a) => ({
        type: "acceptance_criterion" as const,
        id: a.id,
        label: a.ref,
        detail: a.text,
      }));

    return {
      requirement: {
        type: "requirement" as const,
        id: requirement.id,
        label: requirement.ref,
        detail: requirement.title,
      },
      sources,
      useCases,
      criteria,
      packIds: [...new Set(packLinks.get(requirement.id) ?? [])],
      unsourced: sources.length === 0,
    };
  });

  // A source counts as used if anything at all points at it — including an
  // accepted insight, which is how assumptions, constraints and risks carry
  // their lineage.
  const usedSourceIds = new Set<string>();
  const collect = (refs: string[]) => refs.forEach((r) => usedSourceIds.add(r));
  model.requirements.forEach((r) => collect(r.sourceRefs));
  model.useCases.forEach((u) => collect(u.sourceRefs));
  model.acceptanceCriteria.forEach((a) => collect(a.sourceRefs));
  model.businessRules.forEach((b) => collect(b.sourceRefs));
  model.businessGoals.forEach((g) => collect(g.sourceRefs));
  model.stakeholders.forEach((s) => collect(s.sourceRefs));
  model.actors.forEach((a) => collect(a.sourceRefs));
  model.insights
    .filter((i) => i.status !== "dismissed")
    .forEach((i) => usedSourceIds.add(i.sourceDocumentId));

  const contextNodes: TraceNode[] = [
    ...model.businessGoals.map((g) => ({
      type: "business_goal" as const,
      id: g.id,
      label: g.title,
      detail: `${g.sourceRefs.length} source${g.sourceRefs.length === 1 ? "" : "s"}`,
    })),
    ...model.businessRules.map((r) => ({
      type: "business_rule" as const,
      id: r.id,
      label: r.ruleText,
      detail: `${r.sourceRefs.length} source${r.sourceRefs.length === 1 ? "" : "s"}`,
    })),
    ...model.stakeholders.map((s) => ({
      type: "stakeholder" as const,
      id: s.id,
      label: s.name,
      detail: `${s.sourceRefs.length} source${s.sourceRefs.length === 1 ? "" : "s"}`,
    })),
    ...model.actors.map((a) => ({
      type: "actor" as const,
      id: a.id,
      label: a.name,
      detail: `${a.sourceRefs.length} source${a.sourceRefs.length === 1 ? "" : "s"}`,
    })),
  ];

  return {
    chains,
    unusedSources: model.sourceDocuments
      .filter((s) => !usedSourceIds.has(s.id))
      .map((s) => ({
        type: "source_document" as const,
        id: s.id,
        label: s.title,
        detail: s.sourceType.replace(/_/g, " "),
      })),
    orphanUseCases: model.useCases
      .filter((u) => u.requirementId === null)
      .map((u) => ({
        type: "use_case" as const,
        id: u.id,
        label: u.ref,
        detail: u.title,
      })),
    orphanCriteria: model.acceptanceCriteria
      .filter((a) => a.requirementId === null)
      .map((a) => ({
        type: "acceptance_criterion" as const,
        id: a.id,
        label: a.ref,
        detail: a.text,
      })),
    contextNodes,
    totals: {
      sources: model.sourceDocuments.length,
      coveredSources: model.sourceDocuments.filter((s) => usedSourceIds.has(s.id)).length,
      requirements: model.requirements.length,
      sourcedRequirements: model.requirements.filter((r) => r.sourceRefs.length > 0)
        .length,
    },
  };
}
