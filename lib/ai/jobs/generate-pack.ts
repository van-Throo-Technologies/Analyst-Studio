import "server-only";
import { prisma } from "@/lib/db/client";
import { loadProjectModel } from "@/lib/db/queries";
import { AI_EFFORT, AI_MODEL, isAiConfigured } from "@/lib/ai/client";
import { runStructuredJob } from "@/lib/ai/runner";
import { baNarrativeSchema, faNarrativeSchema } from "@/lib/ai/schemas";
import { packNarrativePrompt } from "@/lib/prompts/pack-narrative";
import {
  assembleBaPack,
  assembleFaPack,
  emptyBaNarrative,
  emptyFaNarrative,
} from "@/lib/pack-builders/assemble";
import { renderPackMarkdown } from "@/lib/pack-builders/markdown";
import { renderPackHtml } from "@/lib/pack-builders/html";
import type { Pack, PackMeta } from "@/lib/pack-builders/types";
import { recordTraceLink } from "@/lib/trace/links";
import type { AnalysisMode } from "@/lib/schemas/enums";
import type { ProjectModel } from "@/lib/schemas/entities";

/**
 * Job 6 — pack generation.
 *
 * Order matters: the narrative is written first, the pack is assembled from
 * entities second, and Markdown and HTML are rendered from the assembled JSON
 * third. Nothing downstream of the assembly step can introduce content.
 *
 * Without an API key the job still produces a complete pack — every list is
 * present and correct, and the narrative sections say plainly that they were
 * not written. A pack with honest gaps is more useful than no pack.
 */
export async function generatePack(
  projectId: string,
  mode: AnalysisMode,
): Promise<{ packId: string; narrativeSource: "ai" | "model_only" }> {
  const model = await loadProjectModel(projectId);
  if (!model) throw new Error("Project not found");

  if (model.requirements.length === 0) {
    throw new Error(
      "A pack needs at least one requirement. Build the requirement model first.",
    );
  }

  const useAi = isAiConfigured();
  const meta: PackMeta = {
    projectId,
    projectName: model.project.name,
    mode,
    generatedAt: new Date().toISOString(),
    model: useAi ? AI_MODEL : "—",
    narrativePromptId: packNarrativePrompt.id,
    narrativePromptVersion: packNarrativePrompt.version,
    narrativeSource: useAi ? "ai" : "model_only",
    sourceDocuments: model.sourceDocuments.map((s) => ({ id: s.id, title: s.title })),
  };

  let pack: Pack;

  if (mode === "BA") {
    const narrative = useAi
      ? (
          await runStructuredJob({
            projectId,
            job: "pack_generation",
            prompt: packNarrativePrompt,
            context: { project: model.project, mode },
            input: narrativeInput(model, mode),
            schema: baNarrativeSchema,
            inputEntityIds: entityIds(model),
            effort: AI_EFFORT.narrative,
          })
        ).data
      : emptyBaNarrative(model);
    pack = assembleBaPack({ model, meta, narrative });
  } else {
    const narrative = useAi
      ? (
          await runStructuredJob({
            projectId,
            job: "pack_generation",
            prompt: packNarrativePrompt,
            context: { project: model.project, mode },
            input: narrativeInput(model, mode),
            schema: faNarrativeSchema,
            inputEntityIds: entityIds(model),
            effort: AI_EFFORT.narrative,
          })
        ).data
      : emptyFaNarrative(model);
    pack = assembleFaPack({ model, meta, narrative });
  }

  const created = await prisma.packOutput.create({
    data: {
      projectId,
      mode,
      title: `${model.project.name} — ${mode === "BA" ? "Business" : "Functional"} Analysis Pack`,
      jsonContent: JSON.stringify(pack, null, 2),
      markdownContent: renderPackMarkdown(pack),
      htmlContent: renderPackHtml(pack),
    },
  });

  // Record which entities this pack drew on, so the trace view can answer
  // "which packs would change if I edited REQ-004?".
  for (const requirement of model.requirements) {
    await recordTraceLink({
      projectId,
      fromEntityType: "requirement",
      fromEntityId: requirement.id,
      toEntityType: "pack_section",
      toEntityId: created.id,
      linkReason: `Included in the ${mode} pack generated ${meta.generatedAt.slice(0, 10)}`,
    });
  }

  return { packId: created.id, narrativeSource: meta.narrativeSource };
}

function narrativeInput(model: ProjectModel, mode: AnalysisMode) {
  const acceptedOf = (type: string) =>
    model.insights
      .filter((i) => i.insightType === type && i.status !== "dismissed")
      .map((i) => i.normalizedText);

  return {
    mode,
    goals: model.businessGoals.map((g) =>
      g.description ? `${g.title} — ${g.description}` : g.title,
    ),
    stakeholders: model.stakeholders.map((s) =>
      s.role ? `${s.name} (${s.role})` : s.name,
    ),
    actors: model.actors.map((a) => a.name),
    rules: model.businessRules.map((r) => r.ruleText),
    requirements: model.requirements.map((r) => ({
      ref: r.ref,
      title: r.title,
      type: r.requirementType,
      priority: r.priority,
    })),
    useCases: model.useCases.map((u) => ({
      ref: u.ref,
      title: u.title,
      scopeLevel: u.scopeLevel,
    })),
    assumptions: acceptedOf("assumption"),
    constraints: acceptedOf("constraint"),
    risks: acceptedOf("risk"),
    unreviewedCount: model.insights.filter((i) => i.status === "pending").length,
  };
}

function entityIds(model: ProjectModel): string[] {
  return [
    ...model.requirements.map((r) => r.id),
    ...model.useCases.map((u) => u.id),
    ...model.businessRules.map((r) => r.id),
    ...model.businessGoals.map((g) => g.id),
  ];
}
