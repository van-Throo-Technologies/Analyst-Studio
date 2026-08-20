import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { loadProjectModel } from "@/lib/db/queries";
import { AI_EFFORT } from "@/lib/ai/client";
import { runStructuredJob } from "@/lib/ai/runner";
import { qualityReviewOutputSchema } from "@/lib/ai/schemas";
import { qualityReviewPrompt } from "@/lib/prompts/quality-review";
import { runDeterministicChecks } from "@/lib/quality/deterministic";
import type { AnalysisMode } from "@/lib/schemas/enums";

/**
 * Job 5 — AI quality review.
 *
 * Runs after the deterministic engine and is given its findings, so the two
 * layers stay complementary rather than duplicative. Each run replaces the
 * previous run's open findings: a finding the analyst has already fixed should
 * not linger, and a stale finding is worse than none.
 */
export async function runQualityReview(
  projectId: string,
  mode: AnalysisMode,
): Promise<{ created: number; runId: string }> {
  const model = await loadProjectModel(projectId);
  if (!model) throw new Error("Project not found");

  if (model.requirements.length === 0) {
    throw new Error(
      "There is nothing to review yet. Build some requirements first.",
    );
  }

  const deterministic = runDeterministicChecks(model);
  const requirementRefs = new Map(model.requirements.map((r) => [r.id, r.ref]));

  const acceptedOf = (type: string) =>
    model.insights
      .filter((i) => i.insightType === type && i.status !== "dismissed")
      .map((i) => i.normalizedText);

  const { data } = await runStructuredJob({
    projectId,
    job: "quality_review",
    prompt: qualityReviewPrompt,
    context: { project: model.project, mode },
    input: {
      mode,
      requirements: model.requirements.map((r) => ({
        ref: r.ref,
        title: r.title,
        description: r.description,
        type: r.requirementType,
        priority: r.priority,
      })),
      useCases: model.useCases.map((u) => ({
        ref: u.ref,
        title: u.title,
        scopeLevel: u.scopeLevel,
        primaryActor: u.primaryActor,
        trigger: u.trigger,
        mainFlow: u.mainFlow,
        alternateFlows: u.alternateFlows.map((f) => `${f.name}: ${f.steps.join("; ")}`),
        exceptionFlows: u.exceptionFlows.map((f) => `${f.name}: ${f.steps.join("; ")}`),
        realises: u.requirementId ? (requirementRefs.get(u.requirementId) ?? "") : "",
      })),
      criteria: model.acceptanceCriteria.map((a) => ({
        ref: a.ref,
        text: a.text,
        verifies: a.requirementId ? (requirementRefs.get(a.requirementId) ?? "") : "",
      })),
      rules: model.businessRules.map((r) => r.ruleText),
      goals: model.businessGoals.map((g) =>
        g.description ? `${g.title} — ${g.description}` : g.title,
      ),
      stakeholders: model.stakeholders.map((s) =>
        s.role ? `${s.name} (${s.role})` : s.name,
      ),
      actors: model.actors.map((a) => a.name),
      assumptions: acceptedOf("assumption"),
      constraints: acceptedOf("constraint"),
      alreadyFlagged: deterministic.findings.map(
        (f) => `${f.entityLabel}: ${f.title}`,
      ),
    },
    schema: qualityReviewOutputSchema,
    inputEntityIds: [
      ...model.requirements.map((r) => r.id),
      ...model.useCases.map((u) => u.id),
      ...model.acceptanceCriteria.map((a) => a.id),
    ],
    effort: AI_EFFORT.review,
  });

  const runId = randomUUID();

  // Findings are resolved from the ref the model returned back to a real entity
  // id. A finding pointing at a ref that does not exist is kept — the reference
  // is wrong but the observation may not be — and simply has no entity id.
  const refToEntity = new Map<string, string>();
  model.requirements.forEach((r) => refToEntity.set(r.ref, r.id));
  model.useCases.forEach((u) => refToEntity.set(u.ref, u.id));
  model.acceptanceCriteria.forEach((a) => refToEntity.set(a.ref, a.id));

  await prisma.$transaction([
    prisma.aiFinding.deleteMany({ where: { projectId } }),
    prisma.aiFinding.createMany({
      data: data.findings.map((finding) => ({
        projectId,
        runId,
        severity: finding.severity,
        entityType: finding.entityType,
        entityId: refToEntity.get(finding.entityRef.trim()) ?? finding.entityRef.trim(),
        title: finding.title.trim(),
        explanation: finding.explanation.trim(),
        suggestedFix: finding.suggestedFix.trim(),
      })),
    }),
  ]);

  return { created: data.findings.length, runId };
}
