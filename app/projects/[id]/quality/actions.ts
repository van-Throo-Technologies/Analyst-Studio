"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { AiJobError, AiNotConfiguredError } from "@/lib/ai/client";
import { runQualityReview } from "@/lib/ai/jobs/quality-review";
import { text, type FormState } from "@/lib/forms";
import { analysisModeSchema } from "@/lib/schemas/enums";

export async function runQualityReviewAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const mode = analysisModeSchema.catch("BA").parse(text(formData, "mode"));

  try {
    const { created } = await runQualityReview(projectId, mode);
    revalidatePath(`/projects/${projectId}`, "layout");
    return {
      ok: true,
      message:
        created === 0
          ? "AI review found nothing beyond the automatic checks."
          : `AI review raised ${created} finding${created === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiJobError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof Error) return { ok: false, message: error.message };
    throw error;
  }
}

export async function dismissFindingAction(
  projectId: string,
  findingId: string,
): Promise<void> {
  // Dismissed rather than deleted: a finding the analyst has considered and
  // rejected is itself a record of a decision.
  await prisma.aiFinding.update({
    where: { id: findingId, projectId },
    data: { status: "dismissed" },
  });
  revalidatePath(`/projects/${projectId}`, "layout");
}
