"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { encodeFlowBranches, encodeList } from "@/lib/db/mappers";
import { allocateRef } from "@/lib/db/refs";
import { removeTraceLinksFor } from "@/lib/trace/links";
import { scoreTestability } from "@/lib/quality/testability";
import {
  invalid,
  lines,
  text,
  textList,
  type FormState,
} from "@/lib/forms";
import {
  acceptanceCriterionInputSchema,
  actorInputSchema,
  businessGoalInputSchema,
  businessRuleInputSchema,
  dependencyInputSchema,
  requirementInputSchema,
  stakeholderInputSchema,
  useCaseInputSchema,
  type FlowBranch,
} from "@/lib/schemas/entities";

/**
 * CRUD for every structured entity.
 *
 * Deliberately repetitive rather than abstracted behind a generic handler:
 * each entity has its own field set, its own list columns and its own
 * post-write side effects, and a clever shared writer would obscure all three.
 */

function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function readRequirementForm(formData: FormData) {
  return requirementInputSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    requirementType: text(formData, "requirementType"),
    priority: text(formData, "priority"),
    status: text(formData, "status"),
    owner: text(formData, "owner"),
    rationale: text(formData, "rationale"),
    assumptions: lines(formData, "assumptions"),
    constraints: lines(formData, "constraints"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
}

export async function createRequirementAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readRequirementForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const ref = await allocateRef("requirement", projectId);
  const { assumptions, constraints, sourceRefs, ...rest } = parsed.data;

  await prisma.requirement.create({
    data: {
      projectId,
      ref,
      ...rest,
      assumptionsJson: encodeList(assumptions),
      constraintsJson: encodeList(constraints),
      sourceRefsJson: encodeList(sourceRefs),
    },
  });

  revalidateProject(projectId);
  return { ok: true, message: `${ref} created.` };
}

export async function updateRequirementAction(
  projectId: string,
  requirementId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readRequirementForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const { assumptions, constraints, sourceRefs, ...rest } = parsed.data;

  await prisma.requirement.update({
    where: { id: requirementId, projectId },
    data: {
      ...rest,
      assumptionsJson: encodeList(assumptions),
      constraintsJson: encodeList(constraints),
      sourceRefsJson: encodeList(sourceRefs),
    },
  });

  revalidateProject(projectId);
  return { ok: true, message: "Requirement saved." };
}

export async function deleteRequirementAction(
  projectId: string,
  requirementId: string,
): Promise<void> {
  // Use cases and criteria survive with requirementId set to null rather than
  // being deleted — the quality engine then flags them as orphaned, which is a
  // decision for the analyst rather than a silent cascade.
  await prisma.requirement.delete({ where: { id: requirementId, projectId } });
  await removeTraceLinksFor(projectId, requirementId);
  revalidateProject(projectId);
  redirect(`/projects/${projectId}/requirements`);
}

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------

/** Alternate/exception flows come in as "Name: step; step; step" lines. */
function readFlowBranches(formData: FormData, key: string): FlowBranch[] {
  return lines(formData, key).map((line) => {
    const [head, ...rest] = line.split(":");
    if (rest.length === 0) return { name: line.trim(), steps: [] };
    return {
      name: head.trim(),
      steps: rest
        .join(":")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    };
  });
}

function readUseCaseForm(formData: FormData) {
  const requirementId = text(formData, "requirementId").trim();
  return useCaseInputSchema.safeParse({
    requirementId: requirementId.length > 0 ? requirementId : null,
    title: text(formData, "title"),
    scopeLevel: text(formData, "scopeLevel"),
    primaryActor: text(formData, "primaryActor"),
    supportingActors: lines(formData, "supportingActors"),
    trigger: text(formData, "trigger"),
    preconditions: lines(formData, "preconditions"),
    postconditions: lines(formData, "postconditions"),
    mainFlow: lines(formData, "mainFlow"),
    alternateFlows: readFlowBranches(formData, "alternateFlows"),
    exceptionFlows: readFlowBranches(formData, "exceptionFlows"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
}

function toUseCaseColumns(input: ReturnType<typeof readUseCaseForm>) {
  if (!input.success) throw new Error("unreachable");
  const d = input.data;
  return {
    requirementId: d.requirementId,
    title: d.title,
    scopeLevel: d.scopeLevel,
    primaryActor: d.primaryActor,
    trigger: d.trigger,
    supportingActorsJson: encodeList(d.supportingActors),
    preconditionsJson: encodeList(d.preconditions),
    postconditionsJson: encodeList(d.postconditions),
    mainFlowJson: encodeList(d.mainFlow),
    alternateFlowsJson: encodeFlowBranches(d.alternateFlows),
    exceptionFlowsJson: encodeFlowBranches(d.exceptionFlows),
    sourceRefsJson: encodeList(d.sourceRefs),
  };
}

export async function createUseCaseAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readUseCaseForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  const ref = await allocateRef("useCase", projectId);
  await prisma.useCase.create({
    data: { projectId, ref, ...toUseCaseColumns(parsed) },
  });

  revalidateProject(projectId);
  return { ok: true, message: `${ref} created.` };
}

export async function updateUseCaseAction(
  projectId: string,
  useCaseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readUseCaseForm(formData);
  if (!parsed.success) return invalid(parsed.error);

  await prisma.useCase.update({
    where: { id: useCaseId, projectId },
    data: toUseCaseColumns(parsed),
  });

  revalidateProject(projectId);
  return { ok: true, message: "Use case saved." };
}

export async function deleteUseCaseAction(
  projectId: string,
  useCaseId: string,
): Promise<void> {
  await prisma.useCase.delete({ where: { id: useCaseId, projectId } });
  await removeTraceLinksFor(projectId, useCaseId);
  revalidateProject(projectId);
}

// ---------------------------------------------------------------------------
// Acceptance criteria
// ---------------------------------------------------------------------------

export async function createAcceptanceCriterionAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const requirementId = text(formData, "requirementId").trim();
  const parsed = acceptanceCriterionInputSchema.safeParse({
    requirementId: requirementId.length > 0 ? requirementId : null,
    criterionType: text(formData, "criterionType"),
    text: text(formData, "text"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const ref = await allocateRef("acceptanceCriterion", projectId);
  const { sourceRefs, ...rest } = parsed.data;

  await prisma.acceptanceCriterion.create({
    data: {
      projectId,
      ref,
      ...rest,
      // Scored on write so the model screen can sort and flag without re-running
      // the whole quality engine on every render.
      testabilityScore: scoreTestability(rest.text),
      sourceRefsJson: encodeList(sourceRefs),
    },
  });

  revalidateProject(projectId);
  return { ok: true, message: `${ref} created.` };
}

export async function updateAcceptanceCriterionAction(
  projectId: string,
  criterionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const requirementId = text(formData, "requirementId").trim();
  const parsed = acceptanceCriterionInputSchema.safeParse({
    requirementId: requirementId.length > 0 ? requirementId : null,
    criterionType: text(formData, "criterionType"),
    text: text(formData, "text"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { sourceRefs, ...rest } = parsed.data;
  await prisma.acceptanceCriterion.update({
    where: { id: criterionId, projectId },
    data: {
      ...rest,
      testabilityScore: scoreTestability(rest.text),
      sourceRefsJson: encodeList(sourceRefs),
    },
  });

  revalidateProject(projectId);
  return { ok: true, message: "Criterion saved." };
}

export async function deleteAcceptanceCriterionAction(
  projectId: string,
  criterionId: string,
): Promise<void> {
  await prisma.acceptanceCriterion.delete({ where: { id: criterionId, projectId } });
  await removeTraceLinksFor(projectId, criterionId);
  revalidateProject(projectId);
}

// ---------------------------------------------------------------------------
// Business rules, goals, stakeholders, actors
// ---------------------------------------------------------------------------

export async function saveBusinessRuleAction(
  projectId: string,
  ruleId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = businessRuleInputSchema.safeParse({
    ruleText: text(formData, "ruleText"),
    rationale: text(formData, "rationale"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { sourceRefs, ...rest } = parsed.data;
  const data = { ...rest, sourceRefsJson: encodeList(sourceRefs) };

  if (ruleId) {
    await prisma.businessRule.update({ where: { id: ruleId, projectId }, data });
  } else {
    await prisma.businessRule.create({ data: { projectId, ...data } });
  }

  revalidateProject(projectId);
  return { ok: true, message: ruleId ? "Rule saved." : "Rule added." };
}

export async function deleteBusinessRuleAction(
  projectId: string,
  ruleId: string,
): Promise<void> {
  await prisma.businessRule.delete({ where: { id: ruleId, projectId } });
  await removeTraceLinksFor(projectId, ruleId);
  revalidateProject(projectId);
}

export async function saveBusinessGoalAction(
  projectId: string,
  goalId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = businessGoalInputSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { sourceRefs, ...rest } = parsed.data;
  const data = { ...rest, sourceRefsJson: encodeList(sourceRefs) };

  if (goalId) {
    await prisma.businessGoal.update({ where: { id: goalId, projectId }, data });
  } else {
    await prisma.businessGoal.create({ data: { projectId, ...data } });
  }

  revalidateProject(projectId);
  return { ok: true, message: goalId ? "Goal saved." : "Goal added." };
}

export async function deleteBusinessGoalAction(
  projectId: string,
  goalId: string,
): Promise<void> {
  await prisma.businessGoal.delete({ where: { id: goalId, projectId } });
  await removeTraceLinksFor(projectId, goalId);
  revalidateProject(projectId);
}

export async function saveStakeholderAction(
  projectId: string,
  stakeholderId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = stakeholderInputSchema.safeParse({
    name: text(formData, "name"),
    role: text(formData, "role"),
    notes: text(formData, "notes"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { sourceRefs, ...rest } = parsed.data;
  const data = { ...rest, sourceRefsJson: encodeList(sourceRefs) };

  if (stakeholderId) {
    await prisma.stakeholder.update({ where: { id: stakeholderId, projectId }, data });
  } else {
    await prisma.stakeholder.create({ data: { projectId, ...data } });
  }

  revalidateProject(projectId);
  return { ok: true, message: stakeholderId ? "Stakeholder saved." : "Stakeholder added." };
}

export async function deleteStakeholderAction(
  projectId: string,
  stakeholderId: string,
): Promise<void> {
  await prisma.stakeholder.delete({ where: { id: stakeholderId, projectId } });
  await removeTraceLinksFor(projectId, stakeholderId);
  revalidateProject(projectId);
}

export async function saveActorAction(
  projectId: string,
  actorId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = actorInputSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    sourceRefs: textList(formData, "sourceRefs"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { sourceRefs, ...rest } = parsed.data;
  const data = { ...rest, sourceRefsJson: encodeList(sourceRefs) };

  if (actorId) {
    await prisma.actor.update({ where: { id: actorId, projectId }, data });
  } else {
    await prisma.actor.create({ data: { projectId, ...data } });
  }

  revalidateProject(projectId);
  return { ok: true, message: actorId ? "Actor saved." : "Actor added." };
}

export async function deleteActorAction(
  projectId: string,
  actorId: string,
): Promise<void> {
  await prisma.actor.delete({ where: { id: actorId, projectId } });
  await removeTraceLinksFor(projectId, actorId);
  revalidateProject(projectId);
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function createDependencyAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = dependencyInputSchema.safeParse({
    fromRequirementId: text(formData, "fromRequirementId"),
    toRequirementId: text(formData, "toRequirementId"),
    dependencyType: text(formData, "dependencyType"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return invalid(parsed.error);

  await prisma.dependency.create({ data: { projectId, ...parsed.data } });

  revalidateProject(projectId);
  return { ok: true, message: "Dependency added." };
}

export async function deleteDependencyAction(
  projectId: string,
  dependencyId: string,
): Promise<void> {
  await prisma.dependency.delete({ where: { id: dependencyId, projectId } });
  revalidateProject(projectId);
}
