"use server";

import { revalidatePath } from "next/cache";
import { AiJobError, AiNotConfiguredError } from "@/lib/ai/client";
import {
  draftAcceptanceCriteria,
  draftRequirements,
  draftUseCase,
} from "@/lib/ai/jobs/drafting";
import { text, type FormState } from "@/lib/forms";
import { analysisModeSchema, scopeLevelSchema } from "@/lib/schemas/enums";

/** The AI drafting jobs, exposed to the requirement model screens. */

function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}`, "layout");
}

function toFormState(error: unknown): FormState {
  if (error instanceof AiNotConfiguredError || error instanceof AiJobError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error) return { ok: false, message: error.message };
  throw error;
}

export async function draftRequirementsAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mode = analysisModeSchema.catch("BA").parse(text(formData, "mode"));

  try {
    const { created, notes } = await draftRequirements(projectId, mode);
    revalidateProject(projectId);
    return {
      ok: true,
      message: [
        `Drafted ${created} requirement${created === 1 ? "" : "s"}.`,
        ...notes,
      ].join(" "),
    };
  } catch (error) {
    return toFormState(error);
  }
}

export async function draftUseCaseAction(
  projectId: string,
  requirementId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mode = analysisModeSchema.catch("BA").parse(text(formData, "mode"));
  const scopeLevel = scopeLevelSchema
    .catch(mode === "FA" ? "detailed" : "high_level")
    .parse(text(formData, "scopeLevel"));

  try {
    const { ref } = await draftUseCase(projectId, requirementId, mode, scopeLevel);
    revalidateProject(projectId);
    return { ok: true, message: `${ref} drafted. Review and edit it below.` };
  } catch (error) {
    return toFormState(error);
  }
}

export async function draftCriteriaAction(
  projectId: string,
  requirementId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mode = analysisModeSchema.catch("BA").parse(text(formData, "mode"));

  try {
    const { created } = await draftAcceptanceCriteria(projectId, requirementId, mode);
    revalidateProject(projectId);
    return {
      ok: true,
      message: `Drafted ${created} criteri${created === 1 ? "on" : "a"}. Review the testability scores below.`,
    };
  } catch (error) {
    return toFormState(error);
  }
}
